import { Scenario, ControlSignal, DEFAULT_CONTROL, TelemetryPoint, ScenarioEvent } from '../types';
import { gpuAssist } from '../gpuAssist';

export type RunnerStatus = 'idle' | 'running' | 'paused';

export interface RunnerHooks {
    onTelemetry: (data: TelemetryPoint) => void;
    onStatusChange: (status: RunnerStatus) => void;
    onEvent: (event: ScenarioEvent) => void;
}

export class ScenarioRunner {
    private scenario: Scenario | null = null;
    private status: RunnerStatus = 'idle';
    private animationFrameId: number | null = null;
    private hooks: RunnerHooks;

    // Time control
    private tps: number = 20; // Default ticks per second
    private lastFrameTime: number = 0;
    private accumulatedTime: number = 0;

    // Control signal maintained by runner
    private currentControl: ControlSignal = { ...DEFAULT_CONTROL };

    constructor(hooks: Partial<RunnerHooks>) {
        this.hooks = {
            onTelemetry: hooks.onTelemetry || (() => { }),
            onStatusChange: hooks.onStatusChange || (() => { }),
            onEvent: hooks.onEvent || (() => { })
        };

        void gpuAssist.initialize();
    }

    public setScenario(scenario: Scenario) {
        this.stop();
        this.scenario = scenario;
        // Reset state?
    }

    public start() {
        if (!this.scenario) {
            console.error("No scenario loaded");
            return;
        }
        if (this.status === 'running') return;

        this.status = 'running';
        this.hooks.onStatusChange('running');
        this.lastFrameTime = performance.now();
        this.accumulatedTime = 0;

        this.loop();
    }

    public pause() {
        this.status = 'paused';
        this.hooks.onStatusChange('paused');
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public stop() {
        this.pause();
        this.status = 'idle';
        this.hooks.onStatusChange('idle');
    }

    public setTPS(tps: number) {
        this.tps = Math.max(1, Math.min(60, tps));
    }

    public setControl(control: Partial<ControlSignal>) {
        this.currentControl = { ...this.currentControl, ...control };
    }

    private loop = () => {
        if (this.status !== 'running' || !this.scenario) return;

        const now = performance.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Cap frame time to avoid spiral of death (max 100ms)
        const dt = Math.min(frameTime, 100);
        this.accumulatedTime += dt;

        const timePerTick = 1000 / this.tps;

        while (this.accumulatedTime >= timePerTick) {
            this.scenario.step(this.currentControl);
            const metrics = this.scenario.getMetrics();
            gpuAssist.tick({
                control: this.currentControl.U,
                generation: metrics.generation,
                C: metrics.C,
                A: metrics.A
            });
            this.accumulatedTime -= timePerTick;

            // Check for events
            const events = this.scenario.getEvents();
            if (events.length > 0) {
                events.forEach(e => this.hooks.onEvent(e));
                this.scenario.clearEvents();
            }
        }

        // Emit telemetry every frame (or could throttle this to TPS)
        // For smooth UI, maybe interpolate? For now, just get latest.
        this.hooks.onTelemetry(this.scenario.getMetrics());

        this.animationFrameId = requestAnimationFrame(this.loop);
    };

    public getStatus(): RunnerStatus {
        return this.status;
    }
}
