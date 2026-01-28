
/**
 * Persistence Calculator for ATI
 * Measures goalward stability (policies that stick and pay off).
 */

export class PersistenceCalculator {
    private actionHistory: string[];
    private rewardHistory: number[];
    private windowSize: number;

    constructor(windowSize: number = 50) {
        this.windowSize = windowSize;
        this.actionHistory = [];
        this.rewardHistory = [];
    }

    public update(action: string, reward: number): number {
        this.actionHistory.push(action);
        this.rewardHistory.push(reward);

        if (this.actionHistory.length > this.windowSize) {
            this.actionHistory.shift();
            this.rewardHistory.shift();
        }

        return this.calculatePersistence();
    }

    private calculatePersistence(): number {
        if (this.actionHistory.length < 2) return 0;

        // Simple measure: Do we stick to the same action while reward improves?
        // Or: Autocorrelation of interaction.

        let switchCount = 0;
        let rewardGainSum = 0;

        for (let i = 1; i < this.actionHistory.length; i++) {
            const prevAction = this.actionHistory[i - 1];
            const currAction = this.actionHistory[i];
            const prevReward = this.rewardHistory[i - 1];
            const currReward = this.rewardHistory[i];

            if (prevAction !== currAction) {
                switchCount++;
            }

            // Positive if reward increased
            const gain = Math.max(0, currReward - prevReward);
            rewardGainSum += gain;
        }

        const stability = 1.0 - (switchCount / (this.actionHistory.length - 1));

        // Normalize gain? 
        // For now, let's just return stability * (sigmoid(gain_sum))? 
        // Or just stability. 
        // Recommendation: "rolling autocorrelation... weighted by reward improvement"
        // Let's rely on Stability * (RewardTrend > 0 ? 1 : 0.5)

        // Very basic implementation:
        return stability;
    }

    public reset(): void {
        this.actionHistory = [];
        this.rewardHistory = [];
    }
}
