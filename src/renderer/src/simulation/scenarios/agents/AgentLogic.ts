
import { AgentEntity, AgentTask, AgentSkill, ActionType, AgentGenome } from './AgentTypes';
import { PRNG } from '../../../common/prng';

export class AgentLogic {
    public entity: AgentEntity;

    constructor(entity: AgentEntity) {
        this.entity = entity;
    }

    static random(prng: PRNG, generation: number = 0): AgentEntity {
        const id = `agent-${Date.now()}-${prng.nextInt(0, 10000)}`;
        return {
            id,
            lineageId: `lineage-${id}`,
            birthGeneration: generation,
            genome: {
                id: `genome-${prng.nextInt(0, 10000)}`,
                planDepth: prng.nextInt(1, 3), // 1 to 3
                skillCreationThreshold: 0.5 + prng.next() * 0.5, // 0.5 to 1.0
                toolboxSizeLimit: prng.nextInt(5, 20),
                learningRate: 0.1
            },
            skills: [],
            energy: 100,
            score: 0,
            previousPolicyState: []
        };
    }

    /**
     * Attempt to solve a task using current skills or "raw effort"
     */
    public solve(task: AgentTask, prng: PRNG): { success: boolean, cost: number, usedSkills: number } {
        let totalCost = 0;
        let usedSkillCount = 0;

        // Iterate through requirements
        for (const [type, amount] of Object.entries(task.requirements)) {
            let remaining = amount;
            const actionType = type as ActionType;

            // 1. Check for valid skills
            const bestSkill = this.findBestSkill(actionType);

            if (bestSkill) {
                // Apply skill
                const effectiveCost = remaining * bestSkill.efficiency;
                totalCost += effectiveCost;
                bestSkill.usageCount++;
                usedSkillCount++;

                // Skill maintenance cost?
                totalCost += bestSkill.complexity * 0.1;
            } else {
                // Raw effort (Cost = Amount)
                totalCost += remaining;
            }
        }

        // Check success against energy/budget
        // For MVP, success is probabilistic based on cost vs capacity
        // Let's say agents have a "focus capacity" defined by 100
        const successProb = Math.max(0, 1 - (totalCost / 100));
        const success = prng.next() < successProb;

        // Learning Opportunity (Skill Creation)
        if (success) {
            this.maybeLearnSkill(task, prng);
        }

        return { success, cost: totalCost, usedSkills: usedSkillCount };
    }

    private findBestSkill(type: ActionType): AgentSkill | undefined {
        // Sort by efficiency
        const candidates = this.entity.skills.filter(s => s.targetTypes.includes(type));
        if (candidates.length === 0) return undefined;
        return candidates.sort((a, b) => a.efficiency - b.efficiency)[0]; // Lower is better? No, efficiency factor < 1 is better.
        // Wait, definition: efficiency: number // Multiplier reduces cost. So 0.1 is better than 0.9.
        // Let's sort ascending.
    }

    private maybeLearnSkill(task: AgentTask, prng: PRNG) {
        // Did we struggle with a specific type?
        // Simple heuristic: Randomly crystallize a solution to a dominant requirement
        const types = Object.keys(task.requirements) as ActionType[];
        const target = types[prng.nextInt(0, types.length)];

        // Threshold check
        if (prng.next() > this.entity.genome.skillCreationThreshold) {
            // Learn!
            // Identify if we already have it
            if (this.entity.skills.some(s => s.targetTypes.includes(target))) return;

            // Create new skill
            const newSkill: AgentSkill = {
                id: `skill-${prng.nextInt(0, 10000)}`,
                name: `${target}-Optim`,
                targetTypes: [target],
                efficiency: 0.7, // Initial efficiency
                complexity: 1.0,
                usageCount: 0
            };

            // Manage Toolbox Size
            if (this.entity.skills.length >= this.entity.genome.toolboxSizeLimit) {
                // Forget least used
                this.entity.skills.sort((a, b) => a.usageCount - b.usageCount);
                this.entity.skills.shift(); // Remove first (least used)
            }

            this.entity.skills.push(newSkill);
        }
    }

    public mutate(prng: PRNG, generation: number): AgentEntity {
        const gene = this.entity.genome;

        // Mutate params
        const newMetric = gene.skillCreationThreshold + (prng.next() - 0.5) * 0.1;

        // Decide if speciation event occurred (new lineage)
        // For now, simple chance or if mutation is large
        let lineageId = this.entity.lineageId;
        if (prng.next() < 0.01) { // 1% chance of spontaneous speciation
            lineageId = `lineage-mut-${Date.now()}-${prng.nextInt(0, 1000)}`;
        }

        return {
            ...AgentLogic.random(prng, generation), // Start fresh body
            id: `agent-${Date.now()}-${prng.nextInt(0, 100000)}`,
            lineageId,
            parentId: this.entity.id,
            birthGeneration: generation,
            genome: {
                ...gene,
                id: `genome-${Date.now()}`,
                skillCreationThreshold: Math.max(0, Math.min(1, newMetric))
            },
            // Inherit skills? Maybe some?
            // "Cultural Transmission": Inherit best 2 skills
            skills: this.entity.skills
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 2)
                .slice(0, 2)
                .map(s => ({ ...s, usageCount: 0 })), // Reset stats

            // Pass forward current state as "previous" for the child
            previousPolicyState: new AgentLogic(this.entity).getPolicyState()
        };
    }

    /**
     * Returns a vector representing the agent's current "policy" or skill set.
     * We map the best efficiency for each ActionType.
     * [ NAVIGATE_EFF, COMPUTE_EFF, MANIPULATE_EFF, COMMUNICATE_EFF ]
     */
    public getPolicyState(): number[] {
        const types: ActionType[] = ['NAVIGATE', 'COMPUTE', 'MANIPULATE', 'COMMUNICATE'];
        return types.map(t => {
            const best = this.findBestSkill(t);
            // If no skill, efficiency is 1.0 (raw cost). 
            // If skill, efficiency is < 1.0. 
            // We want a "Performance" metric, so maybe 1/Efficiency?
            // Or just raw Efficiency. Let's use Efficiency.
            return best ? best.efficiency : 1.0;
        });
    }
}
