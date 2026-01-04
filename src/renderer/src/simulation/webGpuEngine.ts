
import { SimulationParameters, ControlSignal, SimulationState } from './types';

// WGSL Compute Shader
const SDE_SHADER = `
struct Params {
    k_CD: f32,
    k_U: f32,
    k_DU: f32,
    k_AC: f32,
    tau: f32,
    eps: f32,
    A_alert: f32,
    dt: f32,
    sigma_C: f32,
    sigma_D: f32,
    sigma_A: f32,
    U: f32,
    generation: f32,
    seed: f32,
};

struct AgentState {
    C: f32,
    D: f32,
    A: f32,
    alertRate: f32,
};

// Bind Group 0
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> oldState: array<AgentState>;
@group(0) @binding(2) var<storage, read_write> newState: array<AgentState>;

// PCG Random Number Generator
fn pcg_hash(input: u32) -> u32 {
    let state = input * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

fn rand_float(seed: u32) -> f32 {
    return f32(pcg_hash(seed)) / 4294967296.0;
}

// Box-Muller for Normal Distribution
fn rand_normal(seed_u: u32, seed_v: u32) -> f32 {
    let u = rand_float(seed_u);
    let v = rand_float(seed_v);
    
    // Avoid log(0)
    let u_clamped = max(u, 0.0000001);
    
    return sqrt(-2.0 * log(u_clamped)) * cos(6.28318530718 * v);
}

fn sigmoid(x: f32) -> f32 {
    return 1.0 / (1.0 + exp(-x));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&oldState)) {
        return;
    }

    let current = oldState[index];
    
    // Generate noise
    // Combine index, generation, and separate salts to decorrelate dimensions
    let seed_base = index + u32(params.generation * 1000.0) + u32(params.seed);
    
    let noiseC = params.sigma_C * rand_normal(seed_base, seed_base + 100000u) * sqrt(params.dt);
    let noiseD = params.sigma_D * rand_normal(seed_base + 200000u, seed_base + 300000u) * sqrt(params.dt);
    let noiseA = params.sigma_A * rand_normal(seed_base + 400000u, seed_base + 500000u) * sqrt(params.dt);

    // E1: Complexity
    let dC = (params.k_CD * current.D * (1.0 - current.C) + params.k_U * params.U * (1.0 - current.C) - 0.3 * current.C) * params.dt;
    
    // E2: Diversity
    let dD = (0.25 * (1.0 - current.D) - params.k_DU * params.U * current.D - 0.15 * current.D * current.D) * params.dt;
    
    // E3: Agency
    let dA = (params.k_AC * current.C * (1.0 - current.A) + 0.4 * params.U * current.C * (1.0 - current.A) - 0.35 * current.A) * params.dt;
    
    // E4: Alert Rate
    let alertSignal = sigmoid((current.A - params.A_alert) / params.eps);
    let dAlertRate = (1.0 / params.tau) * alertSignal * params.dt;

    // Update
    var nextC = clamp(current.C + dC + noiseC, 0.0, 1.0);
    var nextD = clamp(current.D + dD + noiseD, 0.0, 1.0);
    var nextA = clamp(current.A + dA + noiseA, 0.0, 1.0);
    var nextAlertRate = max(0.0, current.alertRate + dAlertRate);

    // Write back
    newState[index] = AgentState(nextC, nextD, nextA, nextAlertRate);
}
`;

export class WebGpuEngine {
    private device: GPUDevice | null = null;
    private pipeline: GPUComputePipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;
    
    private paramBuffer: GPUBuffer | null = null;
    private stateBufferA: GPUBuffer | null = null; // Ping
    private stateBufferB: GPUBuffer | null = null; // Pong
    private resultBuffer: GPUBuffer | null = null; // For readback

    private numAgents: number = 65536; // 65k agents
    private initialized: boolean = false;

    // We toggle between ping-pong buffers
    private stepCount: number = 0;

    constructor() {}

    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        if (!navigator.gpu) {
            console.error("WebGPU not supported on this browser.");
            return false;
        }

        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance' // Target the RTX 5080
        });

        if (!adapter) {
            console.error("No WebGPU adapter found.");
            return false;
        }

        this.device = await adapter.requestDevice();

        // Compile Shader
        const shaderModule = this.device.createShaderModule({
            code: SDE_SHADER
        });

        // Pipeline Layout
        // We need a uniform buffer and two storage buffers (current state, next state)
        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main'
            }
        });

        // Create Buffers
        this.paramBuffer = this.device.createBuffer({
            size: 64, // 14 floats * 4 bytes = 56, aligned to 16 bytes -> 64 is safe
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Struct size: 4 floats = 16 bytes
        const stateBufferSize = this.numAgents * 16; 

        // Initial state data (all agents start at default or random)
        const initialData = new Float32Array(this.numAgents * 4);
        for(let i=0; i<this.numAgents; i++) {
            // Initialize with slight variance to see spread immediately
            initialData[i*4 + 0] = 0.1; // C
            initialData[i*4 + 1] = 0.5; // D
            initialData[i*4 + 2] = 0.01; // A
            initialData[i*4 + 3] = 0.0; // alertRate
        }

        this.stateBufferA = this.device.createBuffer({
            size: stateBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        });
        new Float32Array(this.stateBufferA.getMappedRange()).set(initialData);
        this.stateBufferA.unmap();

        this.stateBufferB = this.device.createBuffer({
            size: stateBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        // Result buffer for reading back to CPU
        this.resultBuffer = this.device.createBuffer({
            size: stateBufferSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        this.initialized = true;
        this.stepCount = 0;
        console.log("WebGPU Engine Initialized with RTX 5080 capability (hopefully)");
        return true;
    }

    async step(
        currentParams: SimulationParameters, 
        control: ControlSignal,
        lastState: SimulationState // Used for generation tracking, actual state is on GPU
    ): Promise<SimulationState> {
        if (!this.device || !this.pipeline || !this.paramBuffer || !this.stateBufferA || !this.stateBufferB || !this.resultBuffer) {
            throw new Error("WebGPU not initialized");
        }

        // 1. Update Uniforms
        // Struct alignment in WGSL is strict. Floats are 4 bytes.
        // struct Params {
        //     k_CD: f32, k_U: f32, k_DU: f32, k_AC: f32,
        //     tau: f32, eps: f32, A_alert: f32, dt: f32,
        //     sigma_C: f32, sigma_D: f32, sigma_A: f32, U: f32,
        //     generation: f32, seed: f32
        // };
        const paramArray = new Float32Array([
            currentParams.k_CD, currentParams.k_U, currentParams.k_DU, currentParams.k_AC,
            currentParams.tau, currentParams.eps, currentParams.A_alert, currentParams.dt,
            currentParams.sigma_C, currentParams.sigma_D, currentParams.sigma_A, control.U,
            lastState.generation, Math.random() * 10000 // Seed
        ]);
        
        this.device.queue.writeBuffer(this.paramBuffer, 0, paramArray);

        // 2. Set up Bind Group
        // We swap A and B every frame
        const sourceBuffer = (this.stepCount % 2 === 0) ? this.stateBufferA : this.stateBufferB;
        const destBuffer = (this.stepCount % 2 === 0) ? this.stateBufferB : this.stateBufferA;

        const bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.paramBuffer } },
                { binding: 1, resource: { buffer: sourceBuffer } },
                { binding: 2, resource: { buffer: destBuffer } }
            ]
        });

        // 3. Dispatch
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        // Workgroup size 64. Total agents 65536. Dispatch 1024 groups.
        passEncoder.dispatchWorkgroups(this.numAgents / 64); 
        passEncoder.end();

        // 4. Copy result to readback buffer (optional, maybe not every frame if too slow?)
        // For now, we do it every frame to keep logic simple
        commandEncoder.copyBufferToBuffer(destBuffer, 0, this.resultBuffer, 0, this.numAgents * 16);

        this.device.queue.submit([commandEncoder.finish()]);

        // 5. Read back
        await this.resultBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = this.resultBuffer.getMappedRange();
        const data = new Float32Array(arrayBuffer);

        // 6. Aggregate results (compute mean)
        let sumC = 0, sumD = 0, sumA = 0, sumAlert = 0;
        // Optimization: Don't iterate all 65k in JS main thread if not needed, but JS is fast enough for this.
        // It's just a simple loop.
        for (let i = 0; i < this.numAgents; i++) {
            sumC += data[i*4 + 0];
            sumD += data[i*4 + 1];
            sumA += data[i*4 + 2];
            sumAlert += data[i*4 + 3];
        }
        
        const meanC = sumC / this.numAgents;
        const meanD = sumD / this.numAgents;
        const meanA = sumA / this.numAgents;
        const meanAlert = sumAlert / this.numAgents;

        this.resultBuffer.unmap();
        this.stepCount++;

        return {
            C: meanC,
            D: meanD,
            A: meanA,
            alertRate: meanAlert,
            generation: lastState.generation + currentParams.dt
        };
    }
}
