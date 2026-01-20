
import { Scenario, ScenarioMetadata, ControlSignal, TelemetryPoint, ScenarioEvent } from '../../types';
import { PRNG } from '../../../common/prng';
import { BioState, BioConfig, DEFAULT_BIO_CONFIG, BioAgentState, BioGenome } from './BioTypes';
import { BioAgent } from './BioAgent';

export class BioScenario implements Scenario<BioConfig> {
    public metadata: ScenarioMetadata = {
        id: 'bio',
        name: 'Xenobiology Lab',
        description: 'Digital organisms evolve in a toxic, energy-limited environment.',
        version: '0.1.0',
        type: 'bio'
    };

    private state: BioState;
    private config: BioConfig;
    private prng: PRNG;
    private agentLogic: Record<string, BioAgent> = {};
    private eventQueue: ScenarioEvent[] = [];

    constructor() {
        this.prng = new PRNG(Date.now());
        this.config = { ...DEFAULT_BIO_CONFIG };
        this.state = this.getEmptyState();
    }

    private getEmptyState(): BioState {
        return {
            generation: 0,
            agents: [],
            genomes: {},
            totalAvailableEnergy: 0,
            toxicity: 0,
            metrics: {
                C: 0, D: 0, A: 0, U: 0, alertRate: 0,
                populationSize: 0, avgResistance: 0
            }
        };
    }

    public initialize(seed: number, config?: BioConfig) {
        this.prng.setSeed(seed);
        if (config) this.config = { ...DEFAULT_BIO_CONFIG, ...config };

        this.state = this.getEmptyState();
        this.agentLogic = {};
        this.eventQueue = [];
        this.state.totalAvailableEnergy = this.config.energyPerTick;

        // Initialize Pop
        for (let i = 0; i < this.config.initialPopulation; i++) {
            this.spawnAgent(BioAgent.random(this.prng), 50); // Start with buffer energy
        }
    }

    private spawnAgent(logic: BioAgent, initialEnergy: number) {
        const id = logic.genome.id;
        this.agentLogic[id] = logic;
        this.state.genomes[id] = logic.genome;
        this.state.agents.push({
            id: id,
            energy: initialEnergy,
            age: 0
        });
    }

    public updateConfig(config: Partial<BioConfig>) {
        this.config = { ...this.config, ...config };
    }

    public step(control: ControlSignal) {
        this.state.toxicity = control.U;
        this.state.generation++;
        this.state.totalAvailableEnergy = this.config.energyPerTick;

        // 1. Distribute Energy
        // Simple distinct: Equal share? Or Competition?
        // Let's do Equal Share for MVP to allow survival.
        const share = this.state.totalAvailableEnergy / Math.max(1, this.state.agents.length);

        const survivors: BioAgentState[] = [];
        const newAgents: BioAgent[] = []; // Logic wrappers for new kids

        // 2. Update Agents
        this.state.agents.forEach(agentState => {
            const logic = this.agentLogic[agentState.id];

            // Influx
            agentState.energy += share;

            // Cost & Damage
            const metabolicCost = logic.calculateMetabolicCost();
            const toxinDamage = logic.takeToxinDamage(this.state.toxicity);

            agentState.energy -= (metabolicCost + toxinDamage);
            agentState.age++;

            // Check Death
            if (agentState.energy > 0) {
                survivors.push(agentState);

                // Reproduction Check
                // Threshold: Needs buffer energy, plus cost of child
                const reproThreshold = 100 / (logic.genome.reproductionRate + 0.1);

                // Cap population
                const canBreed = this.state.agents.length < this.config.maxPopulation;

                if (canBreed && agentState.energy > reproThreshold) {
                    // Breed
                    const child = logic.mutate(this.prng, this.state.generation);
                    agentState.energy -= 40; // Cost
                    newAgents.push(child);
                }
            } else {
                // Die
                delete this.agentLogic[agentState.id];
                delete this.state.genomes[agentState.id];
            }
        });

        this.state.agents = survivors;

        // Add children
        newAgents.forEach(child => {
            this.spawnAgent(child, 20); // Child starts with some energy
        });

        // 3. Metrics

        const popSize = this.state.agents.length;
        const totalBiomass = this.state.agents.reduce((a, b) => a + b.energy, 0);

        // Resistance Stats
        let resistanceSum = 0;
        let diversitySum = 0;

        // Optimize: just iterate survivors
        survivors.forEach(a => {
            const genome = this.state.genomes[a.id];
            resistanceSum += genome.toxinResistance;
        });

        const avgResistance = popSize > 0 ? resistanceSum / popSize : 0;

        // C (Complexity) = Total Biomass / Scale
        const newC = Math.min(1, totalBiomass / (this.config.maxPopulation * 100));

        // A (Agency) = Survival Efficiency in harsh environment
        // If U is high and Pop is stable/growing, A is high.
        // If U is low, easy survival, A is moderate.
        // A = (PopSize / MaxPop) * (1 + U)
        const newA = Math.min(1, (popSize / this.config.maxPopulation) * (0.5 + control.U));

        // Event: Extinction Risk
        if (popSize < 10 && this.config.initialPopulation > 10) {
            // Only fire if not empty
            if (popSize > 0) {
                // Throttle?
            } else {
                this.eventQueue.push({
                    type: 'threshold_crossed',
                    timestamp: this.state.generation,
                    data: { pop: 0 },
                    message: "EXTINCTION EVENT. Population collapsed."
                });
            }
        }

        const alpha = 0.1;
        this.state.metrics = {
            C: this.state.metrics.C * (1 - alpha) + newC * alpha,
            D: 0.5, // Todo
            A: this.state.metrics.A * (1 - alpha) + newA * alpha,
            U: control.U,
            alertRate: 0,
            populationSize: popSize,
            avgResistance: avgResistance
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

    public getEvents() { return [...this.eventQueue]; }
    public clearEvents() { this.eventQueue = []; }
    public getState() { return this.state; }
    public serialize() { return JSON.stringify(this.state); }
    public deserialize(json: string) {
        this.state = JSON.parse(json);
        // Rebuild Agent Logic
        this.agentLogic = {};
        this.state.agents.forEach(agentState => {
            const genome = this.state.genomes[agentState.id];
            if (genome) {
                this.agentLogic[agentState.id] = new BioAgent(genome);
            }
        });
    }
    public updateConfigGeneric(config: any) { this.updateConfig(config); }
}
