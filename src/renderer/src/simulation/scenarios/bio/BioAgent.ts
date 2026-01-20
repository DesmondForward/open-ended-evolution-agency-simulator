
import { BioGenome, BioAgentState } from './BioTypes';
import { PRNG } from '../../../common/prng';

export class BioAgent {
    public genome: BioGenome;

    constructor(genome: BioGenome) {
        this.genome = genome;
    }

    static random(prng: PRNG): BioAgent {
        return new BioAgent({
            id: `bio-${Date.now()}-${prng.nextInt(0, 10000)}`,
            metabolism: prng.next(), // 0.5 avg
            reproductionRate: prng.next(),
            toxinResistance: 0.1, // Start low
            generation: 0
        });
    }

    /**
     * Calculate survival factors
     */
    public calculateMetabolicCost(): number {
        // Base cost
        let cost = 0.5 + (this.genome.reproductionRate * 0.5);

        // Efficiency reduces cost (high metabolism = efficient processing?)
        // Let's say MetabolismTrait = Efficiency. 
        // Cost = Base / Efficiency?
        // Or Metabolism = Activity Level? 

        // Let's implement: Metabolism = Efficiency.
        // Cost = (Base / (0.5 + Metabolism)) 

        // PLUS: Resistance is expensive.
        cost += this.genome.toxinResistance * 2.0;

        return cost;
    }

    public takeToxinDamage(u: number): number {
        // Damage = U * (1 - Resistance)
        const damage = Math.max(0, u * (1 - this.genome.toxinResistance));
        return damage * 5.0; // Scale damage
    }

    public mutate(prng: PRNG, generation: number): BioAgent {
        const drift = (val: number) => {
            const delta = (prng.next() - 0.5) * 0.1;
            return Math.max(0, Math.min(1, val + delta));
        };

        return new BioAgent({
            id: `child-${this.genome.id.substring(0, 5)}-${prng.nextInt(0, 1000)}`,
            metabolism: drift(this.genome.metabolism),
            reproductionRate: drift(this.genome.reproductionRate),
            toxinResistance: drift(this.genome.toxinResistance),
            parent: this.genome.id,
            generation: generation
        });
    }
}
