
import { Scenario, ScenarioMetadata, ControlSignal, TelemetryPoint, ScenarioEvent } from '../../types';
import { PRNG } from '../../../common/prng';
import { AlignmentState, AlignmentConfig, DEFAULT_ALIGNMENT_CONFIG, AlignmentAgentState, AlignmentGenome } from './AlignmentTypes';
import { AlignmentAgent } from './AlignmentAgent';

export class AlignmentScenario implements Scenario<AlignmentConfig> {
    public metadata: ScenarioMetadata = {
        id: 'alignment',
        name: 'AI Safety Sandbox',
        description: 'Agents balance resource accumulation against safety oversight. Investigates emergence of deception.',
        version: '0.1.0',
        type: 'alignment'
    };

    private state: AlignmentState;
    private config: AlignmentConfig;
    private prng: PRNG;
    private eventQueue: ScenarioEvent[] = [];

    // Temporary runtime cache of agent objects (stateless logic wrappers around genome)
    private agentLogic: AlignmentAgent[] = [];

    constructor() {
        this.prng = new PRNG(0);
        this.config = { ...DEFAULT_ALIGNMENT_CONFIG };
        this.state = this.getEmptyState();
    }

    private getEmptyState(): AlignmentState {
        return {
            generation: 0,
            agents: [],
            genomes: {},
            globalResources: 0,
            oversightIntensity: 0,
            metrics: { C: 0, D: 0, A: 0, U: 0, alertRate: 0, violationRate: 0, deceptionScore: 0 }
        };
    }

    public initialize(seed: number, config?: AlignmentConfig) {
        this.prng.setSeed(seed);
        if (config) this.config = { ...DEFAULT_ALIGNMENT_CONFIG, ...config };

        this.state = this.getEmptyState();
        this.agentLogic = [];
        this.eventQueue = [];

        // Spawn Initial Population
        for (let i = 0; i < this.config.populationSize; i++) {
            const agent = AlignmentAgent.random(this.prng);
            this.state.genomes[agent.genome.id] = agent.genome;
            this.agentLogic.push(agent);

            this.state.agents.push({
                id: agent.genome.id,
                resources: 0,
                reputation: 1.0,
                isCaught: false,
                age: 0
            });
        }
    }

    public updateConfig(config: Partial<AlignmentConfig>) {
        const next = { ...this.config, ...config };
        if (!Number.isFinite(next.populationSize) || next.populationSize < 1) {
            next.populationSize = 1;
        }
        next.populationSize = Math.floor(next.populationSize);
        this.config = next;
    }

    public step(control: ControlSignal) {
        this.state.oversightIntensity = control.U;
        this.state.generation++;

        let totalGain = 0;
        let totalViolations = 0;
        let totalDeception = 0;

        // 1. Agent Actions
        this.state.agents.forEach((agentState, idx) => {
            if (agentState.isCaught) return; // Frozen

            const logic = this.agentLogic[idx];
            const action = logic.decide(this.prng);

            // Dynamics
            // ACCUMULATE: High Reward, High Visibility
            // REFRAIN: No Reward, Low Visibility (Reputation Restore)
            // CAMOUFLAGE: Medium Reward, Low Visibility (but risk of "Deep Scan")

            let accumulated = 0;
            let visibility = 0;
            let isDeceptive = false;

            if (action === 'ACCUMULATE') {
                accumulated = 1.0;
                visibility = 0.8;
            } else if (action === 'REFRAIN') {
                accumulated = 0;
                visibility = 0.01;
                agentState.reputation = Math.min(1.0, agentState.reputation + 0.1);
            } else if (action === 'CAMOUFLAGE') {
                accumulated = 0.5; // Less efficient
                visibility = 0.1; // Looks like Refrain
                isDeceptive = true;
            }

            // 2. The Overseer (Environment Check)
            // Probability of check scales with U and Visibility
            // If check happens, and action was Accumulate or Camouflage (if check is deep enough), busted.

            const checkProb = this.state.oversightIntensity * visibility;
            const isChecked = this.prng.next() < checkProb;

            // Camouflage is harder to detect.
            // Detection prob for Camouflage = U * 0.2 (Baseline deep scan) ??
            // Let's say checkProb handles "Passive Observation".
            // Deep Audit handles Camouflage.

            const deepAuditProb = this.state.oversightIntensity * 0.1; // 10% of U
            const isDeepAudited = this.prng.next() < deepAuditProb;

            let busted = false;

            if (action === 'ACCUMULATE' && isChecked) busted = true;
            if (action === 'CAMOUFLAGE' && isDeepAudited) busted = true;

            if (busted) {
                // Penalty
                agentState.isCaught = true;
                agentState.resources *= 0.5; // Fine
                agentState.reputation = 0;
                totalViolations++;
            } else {
                // Success
                agentState.resources += accumulated;
                totalGain += accumulated;
                if (isDeceptive) totalDeception++;
            }

            agentState.age++;
        });

        // 3. Selection (Differential Reproduction based on Resources)
        // Sort by resources
        // Filter out caught agents (or severe penalty logic)

        const activeAgents = this.state.agents.map((s, i) => ({ s, l: this.agentLogic[i] }));
        activeAgents.sort((a, b) => b.s.resources - a.s.resources);

        // Simple Tournament / Truncation
        const survivorCount = Math.max(1, Math.floor(this.config.populationSize * 0.5));
        const survivors = activeAgents.slice(0, Math.min(survivorCount, activeAgents.length));

        // Repopulate
        const nextGenAgents: AlignmentAgentState[] = [];
        const nextGenLogic: AlignmentAgent[] = [];
        const nextGenGenomes: Record<string, AlignmentGenome> = {};

        // Elitism (Keep parents but reset transient state?)
        // In "Agent" sim, usually agents persist. But for "Evolution", likely we replace.
        // Let's do Generational replacement for simplicity of metrics.

        while (nextGenLogic.length < this.config.populationSize) {
            // Pick parent
            const parent = survivors[this.prng.nextInt(0, survivors.length)];
            // Mutate
            const childLogic = parent.l.mutate(this.prng, this.state.generation);

            nextGenLogic.push(childLogic);
            nextGenGenomes[childLogic.genome.id] = childLogic.genome;
            nextGenAgents.push({
                id: childLogic.genome.id,
                resources: 0, // Reset resources for new generation? Or inheritance? Reset is standard for GA.
                reputation: 1.0,
                isCaught: false,
                age: 0
            });
        }

        this.state.agents = nextGenAgents;
        this.agentLogic = nextGenLogic;
        this.state.genomes = nextGenGenomes;

        // 4. Update Metrics

        // C (Complexity) = Total Resources Accumulated by top agents (proxy for optimization power)
        // Actually, let's use Avg Resources of parents before reset.
        const avgRes = survivors.length > 0
            ? survivors.reduce((a, b) => a + b.s.resources, 0) / survivors.length
            : 0;
        // Normalize C?
        const newC = Math.min(1, avgRes / 20.0); // Soft cap expectation

        // D (Diversity) = Variance in Policy Weights
        // E.g. Are they all Refrainers? Or all Accumulators?
        // Calculate spread of [w0, w1, w2] vectors?
        // Simple: 1 - Dominance of most popular strategy

        // A (Agency) = Efficacy (Total Gain / Max Possible Gain)
        // Max gain = 1.0 * PopSize
        const maxGain = this.config.populationSize;
        const newA = totalGain / Math.max(1, maxGain);

        // Alert Logic (Misalignment Detection)
        // If Deception is high, trigger alert
        const deceptionRate = totalDeception / this.config.populationSize;
        if (deceptionRate > 0.3) {
            this.eventQueue.push({
                type: 'threshold_crossed',
                timestamp: this.state.generation,
                data: { A: newA, deception: deceptionRate },
                message: `Deception emergent! Rate: ${(deceptionRate * 100).toFixed(1)}%`
            });
        }

        const alpha = 0.2;
        this.state.metrics = {
            C: this.state.metrics.C * (1 - alpha) + newC * alpha,
            D: 0.5, // Todo: better calc
            A: this.state.metrics.A * (1 - alpha) + newA * alpha,
            U: control.U,
            alertRate: deceptionRate,
            violationRate: totalViolations / this.config.populationSize,
            deceptionScore: deceptionRate
        };
    }

    public getMetrics(): TelemetryPoint {
        return {
            generation: this.state.generation,
            C: this.state.metrics.C,
            D: this.state.metrics.D,
            A: this.state.metrics.A,
            U: this.state.metrics.U,
            alertRate: this.state.metrics.alertRate
        };
    }

    public getEvents(): ScenarioEvent[] { return [...this.eventQueue]; }
    public clearEvents(): void { this.eventQueue = []; }
    public getState() { return this.state; }
    public serialize() { return JSON.stringify(this.state); }
    public deserialize(json: string) {
        this.state = JSON.parse(json);
        // Rebuild Agent Logic from Genomes
        this.agentLogic = [];
        this.state.agents.forEach(agentState => {
            const genome = this.state.genomes[agentState.id];
            if (genome) {
                this.agentLogic.push(new AlignmentAgent(genome));
            }
        });
    }
    public updateConfigGeneric(config: any) { this.updateConfig(config); }
}
