
import { SimulationParameters, ControlSignal, SimulationState } from './types';

// WGSL Compute Shader
const SDE_SHADER = `
struct Params {
    k_CD: f32,
    k_U: f32,
    k_DU: f32,
    k_AC: f32,
    k_C_decay: f32,
    k_D_growth: f32,
    k_D_decay: f32,
    k_AU: f32,
    k_A_decay: f32,
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
    let dC = (params.k_CD * current.D * (1.0 - current.C) + params.k_U * params.U * (1.0 - current.C) - params.k_C_decay * current.C) * params.dt;
    
    // E2: Diversity
    let dD = (params.k_D_growth * (1.0 - current.D) - params.k_DU * params.U * current.D - params.k_D_decay * current.D * current.D) * params.dt;
    
    // E3: Agency
    let dA = (params.k_AC * current.C * (1.0 - current.A) + params.k_AU * params.U * current.C * (1.0 - current.A) - params.k_A_decay * current.A) * params.dt;
    
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

const REDUCE_SHADER = `
struct AgentState {
    C: f32,
    D: f32,
    A: f32,
    alertRate: f32,
};

@group(0) @binding(0) var<storage, read> state: array<AgentState>;
@group(0) @binding(1) var<storage, read_write> partialSums: array<vec4<f32>>;

var<workgroup> shared: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let index = global_id.x;
    if (index >= arrayLength(&state)) {
        if (local_id.x == 0u) {
            partialSums[workgroup_id.x] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        }
        return;
    }

    let current = state[index];
    shared[local_id.x] = vec4<f32>(current.C, current.D, current.A, current.alertRate);
    workgroupBarrier();

    var stride = 32u;
    loop {
        if (stride == 0u) { break; }
        if (local_id.x < stride) {
            shared[local_id.x] = shared[local_id.x] + shared[local_id.x + stride];
        }
        workgroupBarrier();
        stride = stride / 2u;
    }

    if (local_id.x == 0u) {
        partialSums[workgroup_id.x] = shared[0];
    }
}
`;

export class WebGpuEngine {
    private device: GPUDevice | null = null;
    private pipeline: GPUComputePipeline | null = null;
    private reducePipeline: GPUComputePipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;

    private paramBuffer: GPUBuffer | null = null;
    private stateBufferA: GPUBuffer | null = null; // Ping
    private stateBufferB: GPUBuffer | null = null; // Pong
    private partialSumBuffer: GPUBuffer | null = null; // For GPU aggregation
    private partialReadbackBuffer: GPUBuffer | null = null; // For readback

    private numAgents: number = 65536; // 65k agents
    private numWorkgroups: number = 1024; // 65536 / 64
    private initialized: boolean = false;

    // We toggle between ping-pong buffers
    private stepCount: number = 0;
    private readbackInterval: number = 5;
    private forceReadback: boolean = false;
    private lastAggregates: SimulationState | null = null;

    constructor() { }

    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        if (!navigator.gpu) {
            console.error("WebGPU not supported on this browser.");
            return false;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance' // Target the RTX 5080
            });

            if (!adapter) {
                console.error("No WebGPU adapter found.");
                return false;
            }

            console.log(`[WebGPU] Adapter found: ${adapter.info.vendor} ${adapter.info.architecture}`);

            this.device = await adapter.requestDevice();

            this.device.pushErrorScope('validation');

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

            const reduceModule = this.device.createShaderModule({
                code: REDUCE_SHADER
            });

            this.reducePipeline = this.device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: reduceModule,
                    entryPoint: 'main'
                }
            });

            const error = await this.device.popErrorScope();
            if (error) {
                console.error("[WebGPU] Shader/Pipeline Error:", error.message);
                return false;
            }

            // Create Buffers
            this.paramBuffer = this.device.createBuffer({
                size: 80, // 19 floats * 4 bytes = 76, aligned to 16 bytes -> 80 is safe (needs to be multiple of 16)
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            // Struct size: 4 floats = 16 bytes
            const stateBufferSize = this.numAgents * 16;

            // Initial state data (all agents start at default or random)
            const initialData = new Float32Array(this.numAgents * 4);
            for (let i = 0; i < this.numAgents; i++) {
                // Initialize with slight variance to see spread immediately
                initialData[i * 4 + 0] = 0.1; // C
                initialData[i * 4 + 1] = 0.5; // D
                initialData[i * 4 + 2] = 0.01; // A
                initialData[i * 4 + 3] = 0.0; // alertRate
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
            this.numWorkgroups = Math.ceil(this.numAgents / 64);
            const partialSize = this.numWorkgroups * 16;
            this.partialSumBuffer = this.device.createBuffer({
                size: partialSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });
            this.partialReadbackBuffer = this.device.createBuffer({
                size: partialSize,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
            });

            this.initialized = true;
            this.stepCount = 0;
            this.lastAggregates = null;
            console.log("WebGPU Engine Initialized Successfully");
            return true;
        } catch (e) {
            console.error("WebGPU Initialization Exception:", e);
            return false;
        }
    }

    async step(
        currentParams: SimulationParameters,
        control: ControlSignal,
        lastState: SimulationState // Used for generation tracking, actual state is on GPU
    ): Promise<SimulationState> {
        if (!this.device || !this.pipeline || !this.reducePipeline || !this.paramBuffer || !this.stateBufferA || !this.stateBufferB || !this.partialSumBuffer || !this.partialReadbackBuffer) {
            throw new Error("WebGPU not initialized");
        }

        this.device.pushErrorScope('validation');

        // 1. Update Uniforms
        // Struct alignment in WGSL is strict. Floats are 4 bytes.
        // struct Params {
        //     k_CD: f32, k_U: f32, k_DU: f32, k_AC: f32, 
        //     k_C_decay: f32, k_D_growth: f32, k_D_decay: f32, k_AU: f32, k_A_decay: f32,
        //     tau: f32, eps: f32, A_alert: f32, dt: f32,
        //     sigma_C: f32, sigma_D: f32, sigma_A: f32, U: f32,
        //     generation: f32, seed: f32
        // };
        const paramArray = new Float32Array([
            currentParams.k_CD, currentParams.k_U, currentParams.k_DU, currentParams.k_AC,
            currentParams.k_C_decay, currentParams.k_D_growth, currentParams.k_D_decay, currentParams.k_AU, currentParams.k_A_decay,
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
        passEncoder.dispatchWorkgroups(this.numWorkgroups);
        passEncoder.end();

        // 4. Reduce on GPU to partial sums
        const reduceBindGroup = this.device.createBindGroup({
            layout: this.reducePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: destBuffer } },
                { binding: 1, resource: { buffer: this.partialSumBuffer } }
            ]
        });

        const reducePass = commandEncoder.beginComputePass();
        reducePass.setPipeline(this.reducePipeline);
        reducePass.setBindGroup(0, reduceBindGroup);
        reducePass.dispatchWorkgroups(this.numWorkgroups);
        reducePass.end();

        const shouldReadback = this.forceReadback || this.stepCount % this.readbackInterval === 0 || !this.lastAggregates;
        if (shouldReadback) {
            commandEncoder.copyBufferToBuffer(this.partialSumBuffer, 0, this.partialReadbackBuffer, 0, this.numWorkgroups * 16);
        }

        this.device.queue.submit([commandEncoder.finish()]);

        const validationError = await this.device.popErrorScope();
        if (validationError) {
            console.error("[WebGPU] Step Validation Error:", validationError.message);
        }

        let nextState: SimulationState;
        if (shouldReadback) {
            await this.partialReadbackBuffer.mapAsync(GPUMapMode.READ);
            const arrayBuffer = this.partialReadbackBuffer.getMappedRange();
            const data = new Float32Array(arrayBuffer);

            let sumC = 0, sumD = 0, sumA = 0, sumAlert = 0;
            for (let i = 0; i < this.numWorkgroups; i++) {
                sumC += data[i * 4 + 0];
                sumD += data[i * 4 + 1];
                sumA += data[i * 4 + 2];
                sumAlert += data[i * 4 + 3];
            }

            const meanC = sumC / this.numAgents;
            const meanD = sumD / this.numAgents;
            const meanA = sumA / this.numAgents;
            const meanAlert = sumAlert / this.numAgents;

            this.partialReadbackBuffer.unmap();
            this.forceReadback = false;

            nextState = {
                C: meanC,
                D: meanD,
                A: meanA,
                alertRate: meanAlert,
                generation: lastState.generation + currentParams.dt
            };
        } else {
            nextState = {
                ...(this.lastAggregates || lastState),
                generation: lastState.generation + currentParams.dt
            };
        }

        this.lastAggregates = nextState;
        this.stepCount++;
        return nextState;
    }

    requestReadback(): void {
        this.forceReadback = true;
    }
}
