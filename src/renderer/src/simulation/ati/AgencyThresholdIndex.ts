
/**
 * Agency Threshold Index (ATI)
 * Composite index blending Entropy (E), Causal Density (C), and Persistence (P).
 */

import { EntropyCalculator } from './EntropyCalculator';
import { CausalDensityCalculator } from './CausalDensityCalculator';
import { PersistenceCalculator } from './PersistenceCalculator';

export class AgencyThresholdIndex {
    private entropyCalc: EntropyCalculator;
    private causalCalc: CausalDensityCalculator;
    private persistenceCalc: PersistenceCalculator;

    private weights: { E: number; C: number; P: number };
    private atiHistory: number[] = [];

    constructor() {
        this.entropyCalc = new EntropyCalculator(50);
        this.causalCalc = new CausalDensityCalculator(50);
        this.persistenceCalc = new PersistenceCalculator(50);

        // Default equal weights for now
        this.weights = { E: 0.33, C: 0.33, P: 0.34 };
    }

    public update(
        action: string,
        actionHash: number,
        stateVector: number[],
        reward: number
    ): number {
        // Update components
        const E = this.entropyCalc.update(action);
        const C = this.causalCalc.update(stateVector, actionHash);
        const P = this.persistenceCalc.update(action, reward);

        // Normalize signals (Naive normalization [0,1] assumption)
        // E (Entropy) is usually low for few actions. Max is log2(N).
        // C (Correlation) is [0,1].
        // P (Persistence) is [0,1].

        // Z-score standardization would be better if we had population stats,
        // but for individual online, we'll just squash.

        // Composite Score
        const score =
            (this.weights.E * this.sigmoid(E)) +
            (this.weights.C * C) +
            (this.weights.P * P);

        this.atiHistory.push(score);
        if (this.atiHistory.length > 50) this.atiHistory.shift();

        return score;
    }

    private sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-x));
    }

    public getComponents() {
        return {
            E: this.entropyCalc.update(""), // Hack to get last value? No, calc returns it.
            // Actually calculators return value on update. 
            // We might want to store last values.
        };
    }

    public reset() {
        this.entropyCalc.reset();
        this.causalCalc.reset();
        this.persistenceCalc.reset();
        this.atiHistory = [];
    }
}
