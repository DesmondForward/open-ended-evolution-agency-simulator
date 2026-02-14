class GpuAssist {
    private initialized = false;
    private available = false;
    private device: GPUDevice | null = null;
    private pipeline: GPUComputePipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private paramsBuffer: GPUBuffer | null = null;
    private outputBuffer: GPUBuffer | null = null;

    public async initialize(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        if (!navigator.gpu) {
            return;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (!adapter) return;

            this.device = await adapter.requestDevice();

            const shader = this.device.createShaderModule({
                code: `
                    struct Params {
                        control: f32,
                        generation: f32,
                        cMetric: f32,
                        aMetric: f32,
                    };

                    @group(0) @binding(0) var<uniform> params: Params;
                    @group(0) @binding(1) var<storage, read_write> output: array<f32>;

                    @compute @workgroup_size(1)
                    fn main() {
                        let t = params.generation * 0.011 + params.control * 0.17;
                        output[0] = sin(t) + params.cMetric * 0.3 + params.aMetric * 0.7;
                    }
                `
            });

            this.pipeline = this.device.createComputePipeline({
                layout: 'auto',
                compute: { module: shader, entryPoint: 'main' }
            });

            this.paramsBuffer = this.device.createBuffer({
                size: 16,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.outputBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            this.bindGroup = this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.paramsBuffer } },
                    { binding: 1, resource: { buffer: this.outputBuffer } }
                ]
            });

            this.available = true;
        } catch (error) {
            this.available = false;
            console.warn('[GPU Assist] WebGPU unavailable, using CPU-only execution.', error);
        }
    }

    public tick(payload: { control: number; generation: number; C: number; A: number }): void {
        if (!this.available || !this.device || !this.pipeline || !this.bindGroup || !this.paramsBuffer) {
            return;
        }

        const params = new Float32Array([payload.control, payload.generation, payload.C, payload.A]);
        this.device.queue.writeBuffer(this.paramsBuffer, 0, params);

        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();

        this.device.queue.submit([encoder.finish()]);
    }
}

export const gpuAssist = new GpuAssist();
