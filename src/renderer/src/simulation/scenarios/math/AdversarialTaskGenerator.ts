/**
 * AdversarialTaskGenerator - PAIRED-style Adversarial Task Generation
 * 
 * Implements an adversarial curriculum where a "teacher" agent generates 
 * tasks that are challenging but solvable for the current student population.
 * Based on PAIRED (Protagonist Antagonist Induced Regret Environment Design).
 */

import { MathTask, MathGenome, ASTGenomeData, MathExpression } from './MathTypes';
import { PRNG } from '../../../common/prng';

/**
 * Population statistics used for adaptive task generation
 */
export interface PopulationStats {
    avgSolveRate: number;           // 0-1: average success rate
    avgComplexity: number;          // 0-1: average genome complexity
    diversityScore: number;         // 0-1: population diversity
    weaknessProfile: WeaknessProfile;
}

/**
 * Profile of population weaknesses
 */
export interface WeaknessProfile {
    linearWeakness: number;         // 0-1: struggle with linear equations
    quadraticWeakness: number;      // 0-1: struggle with quadratic equations
    largeCoefficients: number;      // 0-1: struggle with large numbers
    negativeNumbers: number;        // 0-1: struggle with negative numbers
}

/**
 * Adversarial task generation configuration
 */
export interface AdversarialConfig {
    targetSolveRate: number;        // Target difficulty (e.g., 0.5 = 50% solve rate)
    explorationRate: number;        // How often to explore new task types
    maxDifficulty: number;          // Maximum difficulty cap
    adaptationRate: number;         // How quickly to adapt to performance
}

export const DEFAULT_ADVERSARIAL_CONFIG: AdversarialConfig = {
    targetSolveRate: 0.5,
    explorationRate: 0.2,
    maxDifficulty: 1.0,
    adaptationRate: 0.1
};

/**
 * AdversarialTaskGenerator - Generates challenging but solvable tasks
 * 
 * Uses a regret-based objective: maximize the gap between the best and worst
 * performing agents on generated tasks, ensuring tasks are in the "zone of 
 * proximal development" - challenging enough to promote learning but not
 * so hard that no agent can solve them.
 */
export class AdversarialTaskGenerator {
    private prng: PRNG;
    private config: AdversarialConfig;
    private taskHistory: TaskPerformance[] = [];
    private currentDifficulty: number = 0.3;
    private weaknessProfile: WeaknessProfile;

    constructor(seed: number, config: Partial<AdversarialConfig> = {}) {
        this.prng = new PRNG(seed);
        this.config = { ...DEFAULT_ADVERSARIAL_CONFIG, ...config };
        this.weaknessProfile = {
            linearWeakness: 0.5,
            quadraticWeakness: 0.5,
            largeCoefficients: 0.5,
            negativeNumbers: 0.5
        };
    }

    /**
     * Generate an adversarial task based on population performance
     */
    public generate(stats: PopulationStats): MathTask {
        // Update weakness profile from stats
        this.weaknessProfile = stats.weaknessProfile;

        // Adaptive difficulty adjustment
        this.adaptDifficulty(stats.avgSolveRate);

        // Exploration vs exploitation
        if (this.prng.next() < this.config.explorationRate) {
            return this.generateExploratoryTask();
        }

        // Generate task targeting weaknesses
        return this.generateTargetedTask();
    }

    /**
     * Adapt difficulty based on current solve rate
     */
    private adaptDifficulty(solveRate: number): void {
        const targetRate = this.config.targetSolveRate;
        const diff = solveRate - targetRate;

        // If solving too easily, increase difficulty
        // If solving too rarely, decrease difficulty
        this.currentDifficulty += diff * this.config.adaptationRate;

        // Clamp to valid range
        this.currentDifficulty = Math.max(0.1,
            Math.min(this.config.maxDifficulty, this.currentDifficulty));
    }

    /**
     * Generate an exploratory task to discover new weaknesses
     */
    private generateExploratoryTask(): MathTask {
        const taskTypes = ['linear_edge', 'quadratic_edge', 'mixed'];
        const selectedType = taskTypes[this.prng.nextInt(0, taskTypes.length)];

        switch (selectedType) {
            case 'linear_edge':
                return this.generateEdgeCaseLinear();
            case 'quadratic_edge':
                return this.generateEdgeCaseQuadratic();
            case 'mixed':
            default:
                return this.generateMixedTask();
        }
    }

    /**
     * Generate a task targeting identified weaknesses
     */
    private generateTargetedTask(): MathTask {
        // Find the greatest weakness
        const weaknesses = [
            { type: 'linear', score: this.weaknessProfile.linearWeakness },
            { type: 'quadratic', score: this.weaknessProfile.quadraticWeakness },
            { type: 'large', score: this.weaknessProfile.largeCoefficients },
            { type: 'negative', score: this.weaknessProfile.negativeNumbers }
        ];

        // Weight selection by weakness score
        const totalWeight = weaknesses.reduce((sum, w) => sum + w.score, 0);
        let r = this.prng.next() * totalWeight;
        let selectedType = 'linear';

        for (const w of weaknesses) {
            r -= w.score;
            if (r <= 0) {
                selectedType = w.type;
                break;
            }
        }

        switch (selectedType) {
            case 'quadratic':
                return this.generateHardQuadratic();
            case 'large':
                return this.generateLargeCoefficients();
            case 'negative':
                return this.generateNegativeHeavy();
            case 'linear':
            default:
                return this.generateTrickyLinear();
        }
    }

    /**
     * Generate tricky linear equation (near-zero coefficients, edge cases)
     */
    private generateTrickyLinear(): MathTask {
        const difficulty = this.currentDifficulty;

        // Use small but tricky coefficients
        const a = this.prng.next() < 0.3 ? 1 : this.prng.nextInt(2, 10);
        const x = this.prng.nextInt(-20, 20);

        // Sometimes use coefficients that nearly cancel
        const b = this.prng.next() < 0.4
            ? -(a * x) + this.prng.nextInt(-5, 5)  // Near-zero result
            : this.prng.nextInt(-50, 50);

        const c = (a * x) + b;

        return {
            id: `adv-linear-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_linear',
            statement: `${a}x + (${b}) = ${c}`,
            coefficients: [a, b, c],
            targetValue: x
        };
    }

    /**
     * Generate challenging quadratic with close/repeated roots
     */
    private generateHardQuadratic(): MathTask {
        const difficulty = this.currentDifficulty;

        // Sometimes generate repeated roots (perfect squares)
        const useRepeatedRoot = this.prng.next() < 0.3;
        let r1: number, r2: number;

        if (useRepeatedRoot) {
            r1 = r2 = this.prng.nextInt(-10, 10);
        } else {
            // Close roots make factoring harder
            r1 = this.prng.nextInt(-10, 10);
            r2 = r1 + this.prng.nextInt(-3, 3);
        }

        const b = -(r1 + r2);
        const c = r1 * r2;

        const bSign = b >= 0 ? '+' : '-';
        const cSign = c >= 0 ? '+' : '-';

        return {
            id: `adv-quad-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_quadratic',
            statement: `x^2 ${bSign} ${Math.abs(b)}x ${cSign} ${Math.abs(c)} = 0`,
            coefficients: [1, b, c, r1, r2],
            targetValue: r1
        };
    }

    /**
     * Generate equations with large coefficients
     */
    private generateLargeCoefficients(): MathTask {
        const difficulty = this.currentDifficulty;
        const scale = Math.floor(50 + difficulty * 150); // 50-200

        const a = this.prng.nextInt(10, scale);
        const x = this.prng.nextInt(-20, 20);
        const b = this.prng.nextInt(-scale, scale);
        const c = (a * x) + b;

        return {
            id: `adv-large-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_linear',
            statement: `${a}x + (${b}) = ${c}`,
            coefficients: [a, b, c],
            targetValue: x
        };
    }

    /**
     * Generate equations heavy on negative numbers
     */
    private generateNegativeHeavy(): MathTask {
        const difficulty = this.currentDifficulty;

        const a = this.prng.next() < 0.5
            ? -this.prng.nextInt(1, 20)
            : this.prng.nextInt(1, 20);
        const x = -Math.abs(this.prng.nextInt(1, 30)); // Always negative answer
        const b = -Math.abs(this.prng.nextInt(1, 50)); // Always negative b
        const c = (a * x) + b;

        return {
            id: `adv-neg-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_linear',
            statement: `${a}x + (${b}) = ${c}`,
            coefficients: [a, b, c],
            targetValue: x
        };
    }

    /**
     * Generate edge case linear (x = 0, x = 1, etc.)
     */
    private generateEdgeCaseLinear(): MathTask {
        const difficulty = this.currentDifficulty;

        // Edge case answers
        const edgeCases = [0, 1, -1, 2, -2];
        const x = edgeCases[this.prng.nextInt(0, edgeCases.length)];

        const a = this.prng.nextInt(1, 20);
        const b = this.prng.nextInt(-30, 30);
        const c = (a * x) + b;

        return {
            id: `adv-edge-lin-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_linear',
            statement: `${a}x + (${b}) = ${c}`,
            coefficients: [a, b, c],
            targetValue: x
        };
    }

    /**
     * Generate edge case quadratic (roots at 0, 1, -1)
     */
    private generateEdgeCaseQuadratic(): MathTask {
        const difficulty = this.currentDifficulty;

        // One root is an edge case
        const edgeCases = [0, 1, -1];
        const r1 = edgeCases[this.prng.nextInt(0, edgeCases.length)];
        const r2 = this.prng.nextInt(-10, 10);

        const b = -(r1 + r2);
        const c = r1 * r2;

        const bSign = b >= 0 ? '+' : '-';
        const cSign = c >= 0 ? '+' : '-';

        return {
            id: `adv-edge-quad-${Date.now()}-${this.prng.nextInt(0, 1000)}`,
            difficulty: difficulty,
            type: 'algebra_quadratic',
            statement: `x^2 ${bSign} ${Math.abs(b)}x ${cSign} ${Math.abs(c)} = 0`,
            coefficients: [1, b, c, r1, r2],
            targetValue: r1
        };
    }

    /**
     * Generate mixed difficulty task
     */
    private generateMixedTask(): MathTask {
        // 50/50 linear vs quadratic
        if (this.prng.next() < 0.5) {
            return this.generateTrickyLinear();
        }
        return this.generateHardQuadratic();
    }

    /**
     * Record task performance for learning
     */
    public recordPerformance(task: MathTask, solveRate: number): void {
        this.taskHistory.push({
            taskId: task.id,
            taskType: task.type,
            difficulty: task.difficulty,
            solveRate,
            timestamp: Date.now()
        });

        // Keep only recent history
        if (this.taskHistory.length > 1000) {
            this.taskHistory = this.taskHistory.slice(-500);
        }

        // Update weakness profile based on performance
        this.updateWeaknessProfile(task, solveRate);
    }

    /**
     * Update weakness profile based on task performance
     */
    private updateWeaknessProfile(task: MathTask, solveRate: number): void {
        const failureRate = 1 - solveRate;
        const learningRate = 0.05;

        if (task.type === 'algebra_linear') {
            this.weaknessProfile.linearWeakness =
                this.weaknessProfile.linearWeakness * (1 - learningRate) +
                failureRate * learningRate;
        } else if (task.type === 'algebra_quadratic') {
            this.weaknessProfile.quadraticWeakness =
                this.weaknessProfile.quadraticWeakness * (1 - learningRate) +
                failureRate * learningRate;
        }

        // Check for large coefficients
        if (task.coefficients && Math.max(...task.coefficients.map(Math.abs)) > 50) {
            this.weaknessProfile.largeCoefficients =
                this.weaknessProfile.largeCoefficients * (1 - learningRate) +
                failureRate * learningRate;
        }

        // Check for negative answers
        if (task.targetValue !== undefined && task.targetValue < 0) {
            this.weaknessProfile.negativeNumbers =
                this.weaknessProfile.negativeNumbers * (1 - learningRate) +
                failureRate * learningRate;
        }
    }

    /**
     * Get current generator state for debugging/monitoring
     */
    public getState(): {
        currentDifficulty: number;
        weaknessProfile: WeaknessProfile;
        recentTaskCount: number;
    } {
        return {
            currentDifficulty: this.currentDifficulty,
            weaknessProfile: { ...this.weaknessProfile },
            recentTaskCount: this.taskHistory.length
        };
    }

    /**
     * Compute regret: difference between best and worst agent on a task
     * High regret = task is in the "zone of proximal development"
     */
    public computeRegret(solveRates: number[]): number {
        if (solveRates.length === 0) return 0;
        const max = Math.max(...solveRates);
        const min = Math.min(...solveRates);
        return max - min;
    }
}

/**
 * Task performance record
 */
interface TaskPerformance {
    taskId: string;
    taskType: string;
    difficulty: number;
    solveRate: number;
    timestamp: number;
}

/**
 * Helper to compute population stats from agent performance
 */
export function computePopulationStats(
    solveRates: number[],
    genomes: MathGenome[]
): PopulationStats {
    const avgSolveRate = solveRates.length > 0
        ? solveRates.reduce((a, b) => a + b, 0) / solveRates.length
        : 0.5;

    const avgComplexity = genomes.length > 0
        ? genomes.reduce((sum, g) => sum + g.complexityScore, 0) / genomes.length
        : 0.5;

    // Simple diversity: variance in complexity scores
    const variance = genomes.length > 1
        ? genomes.reduce((sum, g) => sum + Math.pow(g.complexityScore - avgComplexity, 2), 0) / genomes.length
        : 0;
    const diversityScore = Math.min(1, Math.sqrt(variance) * 4);

    return {
        avgSolveRate,
        avgComplexity,
        diversityScore,
        weaknessProfile: {
            linearWeakness: 0.5,
            quadraticWeakness: 0.5,
            largeCoefficients: 0.5,
            negativeNumbers: 0.5
        }
    };
}
