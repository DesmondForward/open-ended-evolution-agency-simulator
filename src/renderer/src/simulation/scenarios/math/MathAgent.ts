import { MathGenome, MathTask } from './MathTypes';
import { PRNG } from '../../../common/prng';

export class MathAgent {
    public genome: MathGenome;

    constructor(genome: MathGenome) {
        this.genome = genome;
    }

    /**
     * Create a random agent
     */
    static random(prng: PRNG): MathAgent {
        // MVP: The genome is just a "guess strategy" parameter
        // For linear equations ax + b = c => x = (c - b) / a
        // A "dumb" agent might guess random numbers.
        // A "smart" agent might attempt to use the coefficients.

        // For MVP, "Genome" is a set of "heuristic weights":
        // [w_random, w_inverse_ops]

        const weights = [prng.next(), prng.next()];
        // Normalize
        const sum = weights.reduce((a, b) => a + b, 0);
        const normalized = weights.map(w => w / sum);

        return new MathAgent({
            id: `agent-${Date.now()}-${prng.nextInt(0, 10000)}`,
            type: 'numeric_weights',
            data: normalized,
            solvedCount: 0,
            complexityScore: 0.1
        });
    }

    /**
     * Attempt to solve a task
     * Returns the answer found (or NaN)
     */
    public solve(task: MathTask, prng: PRNG): number {
        const weights = this.genome.data as number[];
        const w_random = weights[0];
        const w_smart = weights[1];

        // Probabilistic execution
        const roll = prng.next();

        if (roll < w_random) {
            // Random guess strategy
            return prng.nextInt(-100, 100);
        } else {
            // Smart strategy (analytical inverse)
            // But verify "intelligence" by adding noise based on difficulty?
            // "Perfect" solver:
            if (task.coefficients && task.coefficients.length === 3) {
                const [a, b, c] = task.coefficients;
                // x = (c - b) / a
                // Simulate occasional error based on "complexity cost" vs agent capability?
                // For MVP, just return correct answer to show "Evolution toward Intelligence"
                return (c - b) / a;
            }
            return 0;
        }
    }

    /**
     * Mutate this agent to create a child
     */
    public mutate(prng: PRNG): MathAgent {
        const weights = [...(this.genome.data as number[])];

        // Mutate weights
        const idx = prng.nextInt(0, weights.length);
        weights[idx] += (prng.next() - 0.5) * 0.2; // Shift by +/- 0.1
        weights[idx] = Math.max(0, weights[idx]); // Clamp positive
        // Normalize
        const sum = weights.reduce((a, b) => a + b, 0);
        const normalized = weights.map(w => w / sum);

        return new MathAgent({
            id: `child-${this.genome.id.substring(0, 5)}-${prng.nextInt(0, 1000)}`,
            type: 'numeric_weights',
            data: normalized,
            solvedCount: 0,
            complexityScore: normalized[1] // Complexity = weight on "smart" strategy
        });
    }
}
