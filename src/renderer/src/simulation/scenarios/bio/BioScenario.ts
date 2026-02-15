
import { Scenario, ScenarioMetadata, ControlSignal, TelemetryPoint, ScenarioEvent } from '../../types';
import { PRNG } from '../../../common/prng';
import { BioState, BioConfig, DEFAULT_BIO_CONFIG, BioAgentState, ResourceType } from './BioTypes';
import { BioAgent } from './BioAgent';

export class BioScenario implements Scenario<BioConfig> {
    public metadata: ScenarioMetadata = {
        id: 'bio',
        name: 'Xenobiology Lab (ACE)',
        description: 'Digital organisms evolve in a resource-limited ecosystem with complex metabolic cycles.',
        version: '0.2.0',
        type: 'bio'
    };

    private state: BioState;
    private config: BioConfig;
    private prng: PRNG;
    private agentLogic: Record<string, BioAgent> = {};
    private eventQueue: ScenarioEvent[] = [];

    constructor() {
        this.prng = new PRNG(0);
        this.config = { ...DEFAULT_BIO_CONFIG };
        this.state = this.getEmptyState();
    }

    private getEmptyState(): BioState {
        return {
            generation: 0,
            agents: [],
            genomes: {},
            resources: { SUN: 0, MINERALS: 0, DETRITUS: 0, BIOMASS: 0 },
            toxicity: 0,
            metrics: {
                C: 0, D: 0, A: 0, U: 0, alertRate: 0,
                populationSize: 0, avgResistance: 0,
                functionalDiversity: 0, biomassThroughput: 0, extinctionEvents: 0
            }
        };
    }

    public initialize(seed: number, config?: BioConfig) {
        this.prng.setSeed(seed);
        if (config) this.config = { ...DEFAULT_BIO_CONFIG, ...config };

        this.state = this.getEmptyState();
        this.agentLogic = {};
        this.eventQueue = [];

        // Initial Resource Pools
        this.state.resources.SUN = this.config.energyPerTick;
        this.state.resources.MINERALS = 5000;
        this.state.resources.DETRITUS = 500;

        // Initialize Pop
        for (let i = 0; i < this.config.initialPopulation; i++) {
            this.spawnAgent(BioAgent.random(this.prng), 50);
        }
    }

    private spawnAgent(logic: BioAgent, initialEnergy: number) {
        const id = logic.genome.id;
        this.agentLogic[id] = logic;
        this.state.genomes[id] = logic.genome;
        this.state.agents.push({
            id: id,
            energy: initialEnergy,
            age: 0,
            storedResources: { SUN: 0, MINERALS: 0, DETRITUS: 0, BIOMASS: 0 }
        });
    }

    public updateConfig(config: Partial<BioConfig>) {
        this.config = { ...this.config, ...config };
    }

    public step(control: ControlSignal) {
        this.state.toxicity = control.U;
        this.state.generation++;

        // 1. Resource Influx
        this.state.resources.SUN += this.config.energyPerTick;
        this.state.resources.MINERALS += this.config.mineralInflux;

        // Resource Decay (Detritus decays?)
        this.state.resources.DETRITUS *= 0.99;

        // Distribute Global Resources to Agents (Foraging availability)
        // Agents must FORAGE to move global resources to storedResources
        // Competition: We just calculate availability per agent

        const survivors: BioAgentState[] = [];
        const newAgents: BioAgent[] = [];
        let biomassThroughput = 0;

        // 2. Update Agents
        this.state.agents.forEach(agentState => {
            const logic = this.agentLogic[agentState.id];

            // Decide
            const action = logic.decide(agentState, this.prng, this.state.toxicity, this.state.resources);
            agentState.lastAction = action;

            // Execute Action
            let reward = 0;

            if (action === 'FORAGE') {
                // Try to grab resources
                // Simple: Grab a bit of everything available
                // Proportion based on randomness or specific sensors?
                // Random grab for now
                const types: ResourceType[] = ['SUN', 'MINERALS', 'DETRITUS'];
                types.forEach(t => {
                    const available = this.state.resources[t];
                    const grab = Math.min(available, 2 + this.prng.next() * 3); // 2-5 units
                    if (grab > 0) {
                        this.state.resources[t] -= grab;
                        agentState.storedResources[t] += grab;
                    }
                });
                // Did we get anything? Reward is resource gain?
                reward = 0.5; // Small reward for valid attempt
            }
            else if (action === 'METABOLIZE') {
                // Convert Internal Resources -> Energy + Output
                const result = logic.processMetabolism(agentState);
                agentState.energy += result.energyGain;
                biomassThroughput += result.energyGain; // Estimate
                reward = result.energyGain;

                // Excrete Outputs to environment
                Object.entries(result.produced).forEach(([type, amount]) => {
                    const rType = type as ResourceType;
                    if (rType !== 'BIOMASS') { // Biomass stays? Or excreted? Logic says non-biomass excreted
                        this.state.resources[rType] += amount;
                    }
                });
            }

            // Life Costs
            const cost = logic.calculateMetabolicCost(action);
            const damage = logic.takeToxinDamage(this.state.toxicity, action);
            agentState.energy -= (cost + damage);
            agentState.age++;

            // Update ATI
            const ati = logic.updateAgency(agentState, action, reward);
            agentState.atiScore = ati;

            // Check Death
            if (agentState.energy > 0 && agentState.age < 2000) { // Max age check
                survivors.push(agentState);

                // Reproduction
                const reproThreshold = 150 / (logic.genome.reproductionRate + 0.1);
                if (agentState.energy > reproThreshold && this.state.agents.length < this.config.maxPopulation) {
                    const child = logic.mutate(this.prng, this.state.generation);
                    agentState.energy -= 50;
                    newAgents.push(child);
                }
            } else {
                // Die: Body becomes Detritus
                this.state.resources.DETRITUS += 10;
                // Lose other stored resources?
                Object.entries(agentState.storedResources).forEach(([k, v]) => {
                    this.state.resources[k as ResourceType] += v;
                });

                delete this.agentLogic[agentState.id];
                delete this.state.genomes[agentState.id];
            }
        });

        this.state.agents = survivors;
        newAgents.forEach(child => this.spawnAgent(child, 20));

        // 3. Metrics
        const popSize = this.state.agents.length;

        // Functional Diversity: How many unique metabolic graphs?
        // Simple hash of input->output pairs
        const graphs = new Set<string>();
        survivors.forEach(a => {
            const g = this.state.genomes[a.id];
            const hash = g.metabolicPathways.reactions.map(r => `${r.input} > ${r.output}`).sort().join('|');
            graphs.add(hash);
        });

        const newD = Math.min(1, graphs.size / 20); // Normalize
        const newC = Math.min(1, biomassThroughput / 10000);

        // Extinction?
        if (popSize === 0 && this.config.initialPopulation > 0 && this.state.metrics.populationSize > 0) {
            this.state.metrics.extinctionEvents++;
            this.eventQueue.push({
                type: 'extinction',
                timestamp: this.state.generation,
                data: {},
                message: "ECOSYSTEM COLLAPSE"
            });
            // Rescue?
            if (this.config.initialPopulation > 10) {
                // Auto-reseed small amount
                for (let i = 0; i < 5; i++) this.spawnAgent(BioAgent.random(this.prng), 50);
            }
        }

        const alpha = 0.1;
        this.state.metrics.C = this.state.metrics.C * (1 - alpha) + newC * alpha;
        this.state.metrics.D = this.state.metrics.D * (1 - alpha) + newD * alpha;

        // Agency = ATI max
        let maxAti = 0;
        survivors.forEach(a => maxAti = Math.max(maxAti, a.atiScore || 0));
        this.state.metrics.A = this.state.metrics.A * (1 - alpha) + maxAti * alpha;

        // Check for emergence
        if (maxAti > 0.8) {
            // Throttling: Only once every 50 gens? Or check if agent already logged?
            // For now, simple probability throttle to avoid spam
            if (this.prng.next() < 0.05) {
                const bestAgentState = survivors.reduce((prev, curr) => (prev.atiScore || 0) > (curr.atiScore || 0) ? prev : curr);
                // We need the genome
                const genome = this.state.genomes[bestAgentState.id];

                this.eventQueue.push({
                    type: 'agent_emerged',
                    timestamp: this.state.generation,
                    data: {
                        id: bestAgentState.id,
                        timestamp: new Date().toISOString(),
                        name: `Bio-Agent-${bestAgentState.id.substring(0, 5)}`,
                        description: `High Agency Bio-Agent (ATI=${(bestAgentState.atiScore || 0).toFixed(2)}) from Xenobiology Lab.`,
                        tags: ['Bio-Agent', 'High-ATI'],
                        generation: this.state.generation,
                        metrics: {
                            A: this.state.metrics.A,
                            C: this.state.metrics.C,
                            D: this.state.metrics.D,
                            alertRate: this.state.metrics.alertRate
                        },
                        parameters: { ...this.config, genome }, // Save config + genome
                        environmentalControl: { U: this.state.metrics.U },
                        historySnippet: [],
                        validationMetrics: {
                            stateBoundsViolationRate: 0,
                            diversityFloorViolationFraction: 0,
                            controlBoundsViolationRate: 0
                        },
                        runContext: {
                            bestAgencySoFar: this.state.metrics.A
                        }
                    },
                    message: "High ATI Bio-Agent Discovered"
                });
            }
        }

        this.state.metrics.populationSize = popSize;
        this.state.metrics.functionalDiversity = graphs.size;
        this.state.metrics.biomassThroughput = biomassThroughput;
        this.state.metrics.U = control.U;
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
