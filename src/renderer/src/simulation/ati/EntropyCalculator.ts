
/**
 * Entropy Calculator for ATI
 * Measures novelty/complexity of agent state-action distributions.
 */

export class EntropyCalculator {
    private histogram: Map<string, number>;
    private history: string[];
    private windowSize: number;

    constructor(windowSize: number = 50) {
        this.windowSize = windowSize;
        this.history = [];
        this.histogram = new Map();
    }

    public update(action: string): number {
        // Add new action
        this.history.push(action);
        this.histogram.set(action, (this.histogram.get(action) || 0) + 1);

        // Remove old if exceeding window
        if (this.history.length > this.windowSize) {
            const removed = this.history.shift();
            if (removed) {
                const count = this.histogram.get(removed) || 0;
                if (count <= 1) {
                    this.histogram.delete(removed);
                } else {
                    this.histogram.set(removed, count - 1);
                }
            }
        }

        return this.calculateEntropy();
    }

    private calculateEntropy(): number {
        if (this.history.length === 0) return 0;

        let entropy = 0;
        const total = this.history.length;

        for (const count of Array.from(this.histogram.values())) {
            const p = count / total;
            entropy -= p * Math.log2(p);
        }

        return entropy;
    }

    public reset(): void {
        this.history = [];
        this.histogram.clear();
    }
}
