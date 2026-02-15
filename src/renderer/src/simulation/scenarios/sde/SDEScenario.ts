import {
    Scenario,
    ScenarioMetadata,
    SimulationParameters,
    ControlSignal,
    TelemetryPoint,
    ScenarioEvent,
    SimulationState,
    DEFAULT_INITIAL_STATE,
    DEFAULT_PARAMETERS
} from '../../types';
import { eulerMaruyamaStep, shouldTriggerAlert } from '../../sdeEngine';
import { PRNG } from '../../../common/prng';

export class SDEScenario implements Scenario<SimulationParameters> {
    public metadata: ScenarioMetadata = {
        id: 'sde-v1',
        name: 'SDE Macro-Dynamics (v1)',
        description: 'Original stochastic differential equation model for Complexity, Diversity, and Agency.',
        version: '1.0.0',
        title: 'SDE Simulation',
        type: 'sde'
    } as any; // Casting to avoid strict type checks if I added extra fields

    private state: SimulationState;
    private params: SimulationParameters;
    private prng: PRNG;
    private eventQueue: ScenarioEvent[] = [];
    private lastAlertState: boolean = false;
    private lastU: number = 0;

    constructor() {
        this.prng = new PRNG(0);
        this.state = { ...DEFAULT_INITIAL_STATE };
        this.params = { ...DEFAULT_PARAMETERS };
    }

    public initialize(seed: number, config?: SimulationParameters) {
        this.prng.setSeed(seed);
        this.state = { ...DEFAULT_INITIAL_STATE };
        if (config) {
            this.params = { ...DEFAULT_PARAMETERS, ...config };
        } else {
            this.params = { ...DEFAULT_PARAMETERS };
        }
        this.eventQueue = [];
        this.lastAlertState = false;
        this.lastU = 0;
    }

    public updateConfig(config: Partial<SimulationParameters>) {
        this.params = { ...this.params, ...config };
    }

    public step(control: ControlSignal) {
        this.lastU = control.U;
        // Use arrow function to bind the prng context
        this.state = eulerMaruyamaStep(this.state, this.params, control, () => this.prng.next());

        // Check for events
        const isAlert = shouldTriggerAlert(this.state, this.params);
        if (isAlert && !this.lastAlertState) {
            this.eventQueue.push({
                type: 'threshold_crossed',
                timestamp: this.state.generation,
                data: { A: this.state.A, threshold: this.params.A_alert },
                message: `Agency threshold crossed at gen ${this.state.generation.toFixed(1)}`
            });
        }
        this.lastAlertState = isAlert;
    }

    public getMetrics(): TelemetryPoint {
        return {
            generation: this.state.generation,
            C: this.state.C,
            D: this.state.D,
            A: this.state.A,
            U: this.lastU,
            alertRate: this.state.alertRate
        };
    }

    public getState(): any {
        return {
            simulationState: this.state,
            params: this.params
        };
    }

    public serialize(): string {
        return JSON.stringify({
            state: this.state,
            params: this.params,
            lastU: this.lastU
        });
    }

    public deserialize(json: string): void {
        const data = JSON.parse(json);
        this.state = data.state;
        this.params = data.params;
        this.lastU = data.lastU || 0;
    }

    public getEvents(): ScenarioEvent[] {
        return [...this.eventQueue];
    }

    public clearEvents(): void {
        this.eventQueue = [];
    }
}
