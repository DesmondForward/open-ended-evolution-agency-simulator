
/**
 * Causal Density Calculator for ATI
 * Measures how much variables jointly cause each other.
 * Simplified "Granger-like" implementation.
 */

export class CausalDensityCalculator {
    private stateHistory: number[][]; // [ [s1, s2], [s1, s2] ]
    private actionHistory: number[]; // Mapped to numbers for correlation
    private windowSize: number;

    constructor(windowSize: number = 50) {
        this.windowSize = windowSize;
        this.stateHistory = [];
        this.actionHistory = [];
    }

    public update(stateVector: number[], actionHash: number): number {
        this.stateHistory.push(stateVector);
        this.actionHistory.push(actionHash);

        if (this.stateHistory.length > this.windowSize) {
            this.stateHistory.shift();
            this.actionHistory.shift();
        }

        return this.calculateGrangerProxy();
    }

    private calculateGrangerProxy(): number {
        const N = this.actionHistory.length;
        if (N < 10) return 0; // Need samples

        // Predict Action[t] using Action[t-1] (Baseline)
        // Predict Action[t] using Action[t-1] + State[t-1] (Augmented)

        // Simplified: Measure correlation between State[t-1] and Action[t]
        // If State predicts Action better than random, we have Internal -> Action causality.

        // We will use a very simple difference of variance approach for "Predictability"

        // 1. Variance of Action (Unexplained)
        const actVar = this.variance(this.actionHistory);
        if (actVar < 0.0001) return 0; // Deterministic behavior (or boring)

        // 2. Residual variance after linear fit from State
        // Assuming single dimension state for MVP or average correlation

        // Let's compute average correlation between each state dimension and the action
        let maxCorr = 0;
        const numDims = this.stateHistory[0].length;

        for (let d = 0; d < numDims; d++) {
            const seriesS = this.stateHistory.map(s => s[d]).slice(0, N - 1); // t-1
            const seriesA = this.actionHistory.slice(1, N); // t

            const corr = Math.abs(this.correlation(seriesS, seriesA));
            if (corr > maxCorr) maxCorr = corr;
        }

        return maxCorr;
    }

    private mean(data: number[]): number {
        return data.reduce((a, b) => a + b, 0) / data.length;
    }

    private variance(data: number[]): number {
        const m = this.mean(data);
        return data.reduce((a, b) => a + Math.pow(b - m, 2), 0) / data.length;
    }

    private correlation(xs: number[], ys: number[]): number {
        const n = xs.length;
        if (n !== ys.length || n === 0) return 0;

        const mx = this.mean(xs);
        const my = this.mean(ys);

        let num = 0;
        let denX = 0;
        let denY = 0;

        for (let i = 0; i < n; i++) {
            const dx = xs[i] - mx;
            const dy = ys[i] - my;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
        }

        if (denX === 0 || denY === 0) return 0;
        return num / Math.sqrt(denX * denY);
    }

    public reset(): void {
        this.stateHistory = [];
        this.actionHistory = [];
    }
}
