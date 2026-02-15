
import { BioGenome, BioAgentState, Reaction, ResourceType } from './BioTypes';
import { PRNG } from '../../../common/prng';
import { AgencyThresholdIndex } from '../../ati/AgencyThresholdIndex';

export class BioAgent {
    public genome: BioGenome;
    public ati: AgencyThresholdIndex;

    constructor(genome: BioGenome) {
        this.genome = genome;
        this.ati = new AgencyThresholdIndex();
    }

    static random(prng: PRNG): BioAgent {
        // Generate random metabolic graph
        const reactions: Reaction[] = [];
        const possibleInputs: ResourceType[] = ['SUN', 'MINERALS', 'DETRITUS'];
        const possibleOutputs: ResourceType[] = ['BIOMASS', 'DETRITUS'];

        // 1 to 3 reactions
        const count = prng.nextInt(1, 4);
        for (let i = 0; i < count; i++) {
            reactions.push({
                id: `rxn-${prng.nextInt(0, 1000)}`,
                input: possibleInputs[prng.nextInt(0, possibleInputs.length)],
                output: possibleOutputs[prng.nextInt(0, possibleOutputs.length)],
                efficiency: 0.5 + prng.next() * 0.4,
                yield: 0.8 + prng.next() * 0.4
            });
        }

        return new BioAgent({
            id: `bio-${prng.nextInt(0, 10000)}`,
            metabolism: prng.next(),
            reproductionRate: prng.next(),
            toxinResistance: 0.1,
            foragingValence: prng.next(),
            metabolicPathways: { reactions },
            generation: 0
        });
    }

    /**
     * Decision Logic
     * Returns action string: 'FORAGE' | 'REST' | 'METABOLIZE'
     */
    public decide(state: BioAgentState, prng: PRNG, envToxicity: number, envResources: Record<ResourceType, number>): string {
        const energyPressure = 1.0 - Math.min(1, state.energy / 150);

        // Can we metabolize?
        // Check if we have input resources in inventory for our reactions
        const canMetabolize = this.genome.metabolicPathways.reactions.some(r =>
            (state.storedResources[r.input] || 0) > 1
        );

        if (canMetabolize && energyPressure > 0.3) {
            return 'METABOLIZE';
        }

        // Else, Forage?
        // If external resources are high, probability increases
        const resourceSmell = (envResources['SUN'] + envResources['MINERALS'] + envResources['DETRITUS']) / 1000;

        const probForage = (this.genome.foragingValence * 0.4) + (energyPressure * 0.4) + (resourceSmell * 0.2);

        if (prng.next() < probForage) {
            return 'FORAGE';
        }

        return 'REST';
    }

    // Process metabolism: Convert Internal Resources -> Energy + Waste (Output)
    public processMetabolism(state: BioAgentState): { energyGain: number, produced: Record<ResourceType, number> } {
        let energyGain = 0;
        const produced: Record<ResourceType, number> = { SUN: 0, MINERALS: 0, DETRITUS: 0, BIOMASS: 0 };

        this.genome.metabolicPathways.reactions.forEach(r => {
            const available = state.storedResources[r.input] || 0;
            if (available > 1) {
                // Consume
                const amount = 1; // Rate limited per tick
                state.storedResources[r.input] -= amount;

                // Produce Energy
                const e = amount * 10 * r.efficiency * r.yield;
                energyGain += e;

                // Produce Output resource (Waste/Product)
                // If output is BIOMASS, it stays in agent body (energy/growth)? 
                // Or excreted?
                // Let's say BIOMASS turns into Growth (Energy), others are excreted.
                if (r.output === 'BIOMASS') {
                    energyGain += amount * 5; // Extra energy
                } else {
                    produced[r.output] += amount * 0.8; // Some loss
                }
            }
        });

        return { energyGain, produced };
    }

    public calculateMetabolicCost(action: string): number {
        let cost = 0.5 + (this.genome.reproductionRate * 0.5);
        if (action === 'FORAGE') cost += 2.0;
        else if (action === 'METABOLIZE') cost += 1.0;
        else cost += 0.2; // Deep rest

        cost = cost / (0.5 + this.genome.metabolism);
        cost += this.genome.toxinResistance * 2.0;
        return cost;
    }

    public takeToxinDamage(u: number, action: string): number {
        let exposure = 1.0;
        if (action === 'REST') exposure = 0.5;
        const damage = Math.max(0, u * exposure * (1 - this.genome.toxinResistance));
        return damage * 5.0;
    }

    public mutate(prng: PRNG, generation: number): BioAgent {
        const drift = (val: number) => Math.max(0, Math.min(1, val + (prng.next() - 0.5) * 0.1));

        // Mutate Graph: Add/Remove reaction
        const newReactions = [...this.genome.metabolicPathways.reactions];

        if (prng.next() < 0.1) {
            // Mutation event
            if (prng.next() > 0.5 && newReactions.length < 5) {
                // Add
                newReactions.push({
                    id: `rxn-${prng.nextInt(0, 1000)}`,
                    input: ['SUN', 'MINERALS', 'DETRITUS'][prng.nextInt(0, 3)] as ResourceType,
                    output: ['BIOMASS', 'DETRITUS'][prng.nextInt(0, 2)] as ResourceType,
                    efficiency: prng.next(),
                    yield: prng.next()
                });
            } else if (newReactions.length > 1) {
                // Remove
                newReactions.splice(prng.nextInt(0, newReactions.length), 1);
            }
        }

        return new BioAgent({
            id: `child-${prng.nextInt(0, 1000)}`,
            metabolism: drift(this.genome.metabolism),
            reproductionRate: drift(this.genome.reproductionRate),
            toxinResistance: drift(this.genome.toxinResistance),
            foragingValence: drift(this.genome.foragingValence),
            metabolicPathways: { reactions: newReactions },
            parent: this.genome.id,
            generation: generation
        });
    }

    public updateAgency(state: BioAgentState, action: string, reward: number): number {
        const sVec = [Math.min(1, state.energy / 200), Math.min(1, state.age / 100)];
        const aHash = action === 'FORAGE' ? 1 : (action === 'METABOLIZE' ? 2 : 0);
        return this.ati.update(action, aHash, sVec, reward);
    }
}
