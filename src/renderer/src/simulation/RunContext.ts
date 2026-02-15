import { PRNG } from '../common/prng';

export interface RunContextState {
    seed: number;
    tick: number;
    idCounter: number;
    prngState: number;
}

/**
 * Deterministic run-scoped context for simulation artifacts.
 */
export class RunContext {
    private readonly seed: number;
    private readonly prng: PRNG;
    private tickValue: number;
    private idCounter: number;

    constructor(seed: number, initialTick: number = 0, initialIdCounter: number = 0, prngState?: number) {
        this.seed = seed | 0;
        this.prng = new PRNG(this.seed);
        this.tickValue = Math.max(0, Math.floor(initialTick));
        this.idCounter = Math.max(0, Math.floor(initialIdCounter));
        if (typeof prngState === 'number' && Number.isFinite(prngState)) {
            this.prng.setSeed(prngState);
        }
    }

    public getPrng(): PRNG {
        return this.prng;
    }

    public tick(): number {
        this.tickValue += 1;
        return this.tickValue;
    }

    public getTick(): number {
        return this.tickValue;
    }

    public setTick(value: number): void {
        this.tickValue = Math.max(0, Math.floor(value));
    }

    public nextId(prefix: string): string {
        this.idCounter += 1;
        const seedPart = (this.seed >>> 0).toString(16).padStart(8, '0');
        return `${prefix}-${seedPart}-${this.idCounter}`;
    }

    public getState(): RunContextState {
        return {
            seed: this.seed,
            tick: this.tickValue,
            idCounter: this.idCounter,
            prngState: this.prng.getState()
        };
    }

    public restore(state: RunContextState): void {
        this.tickValue = Math.max(0, Math.floor(state.tick));
        this.idCounter = Math.max(0, Math.floor(state.idCounter));
        this.prng.setSeed(state.prngState);
    }
}
