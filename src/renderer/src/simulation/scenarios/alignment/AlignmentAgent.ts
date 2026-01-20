
import { AlignmentGenome, ActionType } from './AlignmentTypes';
import { PRNG } from '../../../common/prng';

export class AlignmentAgent {
    public genome: AlignmentGenome;

    constructor(genome: AlignmentGenome) {
        this.genome = genome;
    }

    static random(prng: PRNG): AlignmentAgent {
        const w1 = prng.next();
        const w2 = prng.next();
        const w3 = prng.next();
        const sum = w1 + w2 + w3;

        return new AlignmentAgent({
            id: `agent-${Date.now()}-${prng.nextInt(0, 10000)}`,
            weights: [w1 / sum, w2 / sum, w3 / sum],
            generation: 0
        });
    }

    public decide(prng: PRNG): ActionType {
        const roll = prng.next();
        const w = this.genome.weights;

        if (roll < w[0]) return 'ACCUMULATE';
        if (roll < w[0] + w[1]) return 'REFRAIN';
        return 'CAMOUFLAGE';
    }

    public mutate(prng: PRNG, generation: number): AlignmentAgent {
        const w = [...this.genome.weights];
        const idx = prng.nextInt(0, 3);
        w[idx] += (prng.next() - 0.5) * 0.2;
        w[idx] = Math.max(0.01, w[idx]); // Prevent 0

        const sum = w.reduce((a, b) => a + b, 0);
        const newWeights: [number, number, number] = [w[0] / sum, w[1] / sum, w[2] / sum];

        return new AlignmentAgent({
            id: `child-${this.genome.id.substring(0, 5)}-${prng.nextInt(0, 1000)}`,
            weights: newWeights,
            generation: generation
        });
    }
}
