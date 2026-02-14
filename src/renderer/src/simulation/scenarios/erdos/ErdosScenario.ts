import {
    Scenario,
    ScenarioMetadata,
    ControlSignal,
    TelemetryPoint,
    ScenarioEvent
} from '../../types';
import { PRNG } from '../../../common/prng';
import {
    DEFAULT_ERDOS_CONFIG,
    DiscoveryAgent,
    ErdosConfig,
    ErdosProblem,
    ErdosState,
    ProblemDomain
} from './ErdosTypes';

const PROBLEM_BANK: Array<Omit<ErdosProblem, 'solved' | 'solutionQuality'>> = [
    {
        id: 'erdos-distinct-distances',
        title: 'Distinct distances on the plane (minimum distinct distance growth)',
        domain: 'geometry',
        difficulty: 0.82,
        reward: 500
    },
    {
        id: 'erdos-discrepancy',
        title: 'Discrepancy growth for bounded-sign arithmetic progressions',
        domain: 'additive_number_theory',
        difficulty: 0.86,
        reward: 600
    },
    {
        id: 'erdos-turan-cubes',
        title: 'Turán density of 3-uniform hypergraph K4(3)',
        domain: 'combinatorics',
        difficulty: 0.9,
        reward: 700
    },
    {
        id: 'erdos-faber-lovasz',
        title: 'Erdős–Faber–Lovász coloring threshold dynamics',
        domain: 'graph_theory',
        difficulty: 0.75,
        reward: 300
    },
    {
        id: 'erdos-unit-distance',
        title: 'Maximum unit distances among n planar points',
        domain: 'geometry',
        difficulty: 0.74,
        reward: 250
    },
    {
        id: 'erdos-szemeredi-sum-product',
        title: 'Sum-product lower bound exponent improvements',
        domain: 'additive_number_theory',
        difficulty: 0.8,
        reward: 400
    },
    {
        id: 'erdos-hajnal',
        title: 'Erdős–Hajnal exponent amplification in forbidden-subgraph classes',
        domain: 'graph_theory',
        difficulty: 0.78,
        reward: 450
    },
    {
        id: 'erdos-moser',
        title: 'Distinct subset-sum lower bounds for sparse integer sets',
        domain: 'combinatorics',
        difficulty: 0.72,
        reward: 220
    }
];

const DOMAINS: ProblemDomain[] = ['additive_number_theory', 'combinatorics', 'graph_theory', 'geometry'];

export class ErdosScenario implements Scenario<ErdosConfig> {
    public metadata: ScenarioMetadata = {
        id: 'erdos',
        name: 'Erdős Open Problems',
        description: 'Evolving discovery agencies collaborate to close Erdős-style open problems and expand the cognitive light cone.',
        version: '0.1.0',
        type: 'erdos'
    };

    private state: ErdosState;
    private config: ErdosConfig;
    private prng: PRNG;
    private eventQueue: ScenarioEvent[] = [];

    constructor() {
        this.prng = new PRNG(Date.now());
        this.config = { ...DEFAULT_ERDOS_CONFIG };
        this.state = this.getEmptyState();
    }

    private getEmptyState(): ErdosState {
        return {
            generation: 0,
            agents: [],
            activeProblems: [],
            solvedProblems: [],
            metrics: {
                C: 0,
                D: 0,
                A: 0,
                U: 0,
                alertRate: 0,
                solvedRatio: 0,
                activeProblems: 0,
                cumulativeReward: 0,
                cognitiveLightCone: 0
            }
        };
    }

    private randomAgent(index: number): DiscoveryAgent {
        return {
            id: `agency-${this.state.generation}-${index}-${Math.floor(this.prng.next() * 1e6)}`,
            specialization: DOMAINS[this.prng.nextInt(0, DOMAINS.length)],
            creativity: 0.35 + this.prng.next() * 0.55,
            rigor: 0.35 + this.prng.next() * 0.55,
            collaboration: 0.2 + this.prng.next() * 0.7,
            solvedCount: 0
        };
    }

    private reseedProblems() {
        const shuffled = [...PROBLEM_BANK].sort(() => this.prng.next() - 0.5);
        const take = Math.min(this.config.problemsPerGeneration, shuffled.length);
        this.state.activeProblems = shuffled.slice(0, take).map(problem => ({ ...problem, solved: false, solutionQuality: 0 }));
    }

    public initialize(seed: number, config?: ErdosConfig): void {
        this.prng.setSeed(seed);
        this.config = { ...DEFAULT_ERDOS_CONFIG, ...(config || {}) };
        this.state = this.getEmptyState();

        for (let i = 0; i < this.config.populationSize; i++) {
            this.state.agents.push(this.randomAgent(i));
        }

        this.reseedProblems();
    }

    public updateConfig(config: Partial<ErdosConfig>): void {
        const next = { ...this.config, ...config };
        next.populationSize = Math.max(1, Math.floor(next.populationSize));
        next.problemsPerGeneration = Math.max(1, Math.floor(next.problemsPerGeneration));
        next.mutationRate = Math.max(0, Math.min(1, next.mutationRate));
        next.collaborationBoost = Math.max(0, Math.min(1, next.collaborationBoost));
        this.config = next;
    }

    public step(control: ControlSignal): void {
        this.state.generation += 1;

        if (this.state.activeProblems.length === 0) {
            this.reseedProblems();
        }

        let newlySolved = 0;
        let reward = 0;
        const collaborationFactor = control.U * this.config.collaborationBoost;

        for (const problem of this.state.activeProblems) {
            const specialists = this.state.agents.filter(agent => agent.specialization === problem.domain);
            const squad = specialists.length > 0 ? specialists : this.state.agents;
            const contributorCount = Math.max(1, Math.floor(squad.length * (0.2 + collaborationFactor * 0.4)));
            const contributors = [...squad].sort(() => this.prng.next() - 0.5).slice(0, contributorCount);

            const avgCreativity = contributors.reduce((acc, a) => acc + a.creativity, 0) / contributors.length;
            const avgRigor = contributors.reduce((acc, a) => acc + a.rigor, 0) / contributors.length;
            const avgCollab = contributors.reduce((acc, a) => acc + a.collaboration, 0) / contributors.length;

            const basePower = avgCreativity * 0.45 + avgRigor * 0.45 + avgCollab * 0.1;
            const pressureBonus = control.U * 0.15;
            const noise = (this.prng.next() - 0.5) * 0.08;
            const solutionQuality = Math.max(0, Math.min(1, basePower + pressureBonus + noise));
            const threshold = problem.difficulty * (0.85 - collaborationFactor * 0.2);

            problem.solutionQuality = solutionQuality;
            if (solutionQuality >= threshold) {
                problem.solved = true;
                newlySolved += 1;
                reward += problem.reward;
                contributors.forEach(agent => {
                    agent.solvedCount += 1;
                });

                this.eventQueue.push({
                    type: 'task_solved',
                    timestamp: this.state.generation,
                    data: {
                        problemId: problem.id,
                        title: problem.title,
                        domain: problem.domain,
                        quality: solutionQuality
                    },
                    message: `Solved: ${problem.title}`
                });
            }
        }

        const solvedThisRound = this.state.activeProblems.filter(problem => problem.solved);
        if (solvedThisRound.length > 0) {
            this.state.solvedProblems.push(...solvedThisRound);
        }
        this.state.activeProblems = this.state.activeProblems.filter(problem => !problem.solved);

        const solvedRatio = this.state.solvedProblems.length / PROBLEM_BANK.length;
        const specializationSpread = new Set(this.state.agents.map(agent => agent.specialization)).size / DOMAINS.length;
        const avgCollab = this.state.agents.reduce((sum, agent) => sum + agent.collaboration, 0) / this.state.agents.length;
        const avgSkill = this.state.agents.reduce((sum, agent) => sum + (agent.creativity + agent.rigor) / 2, 0) / this.state.agents.length;
        const cognitiveLightCone = Math.min(1, solvedRatio * 0.6 + avgCollab * 0.25 + control.U * 0.15);

        this.state.metrics.C = Math.max(0, Math.min(1, 0.5 * avgSkill + 0.5 * solvedRatio));
        this.state.metrics.D = Math.max(0, Math.min(1, specializationSpread));
        this.state.metrics.A = Math.max(0, Math.min(1, 0.5 * solvedRatio + 0.3 * avgCollab + 0.2 * control.U));
        this.state.metrics.U = control.U;
        this.state.metrics.alertRate = this.state.metrics.A > 0.75 ? this.state.metrics.alertRate * 0.8 + 0.2 : this.state.metrics.alertRate * 0.9;
        this.state.metrics.solvedRatio = solvedRatio;
        this.state.metrics.activeProblems = this.state.activeProblems.length;
        this.state.metrics.cumulativeReward += reward;
        this.state.metrics.cognitiveLightCone = cognitiveLightCone;

        this.state.agents = this.state.agents.map((agent, index) => {
            if (this.prng.next() > this.config.mutationRate) return agent;
            return {
                ...agent,
                creativity: Math.max(0, Math.min(1, agent.creativity + (this.prng.next() - 0.5) * 0.15)),
                rigor: Math.max(0, Math.min(1, agent.rigor + (this.prng.next() - 0.5) * 0.15)),
                collaboration: Math.max(0, Math.min(1, agent.collaboration + (this.prng.next() - 0.5) * 0.15)),
                specialization: this.prng.next() < 0.15 ? DOMAINS[this.prng.nextInt(0, DOMAINS.length)] : agent.specialization,
                id: `${agent.id.split('-')[0]}-${this.state.generation}-${index}-${Math.floor(this.prng.next() * 1e6)}`
            };
        });

        if (newlySolved > 0 && this.state.metrics.A >= 0.7) {
            this.eventQueue.push({
                type: 'agent_emerged',
                timestamp: this.state.generation,
                data: {
                    id: `erdos-agency-${this.state.generation}`,
                    timestamp: new Date().toISOString(),
                    name: 'Erdős Discovery Collective',
                    description: `Collective solved ${newlySolved} open problems this generation with cognitive light cone ${cognitiveLightCone.toFixed(2)}.`,
                    tags: ['Erdos', 'Open-Problems', 'Cognitive-Light-Cone'],
                    generation: this.state.generation,
                    metrics: {
                        A: this.state.metrics.A,
                        C: this.state.metrics.C,
                        D: this.state.metrics.D,
                        alertRate: this.state.metrics.alertRate,
                        cognitiveHorizon: cognitiveLightCone,
                        competency: solvedRatio
                    },
                    parameters: this.config,
                    environmentalControl: { U: control.U },
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
                message: 'New Erdős discovery agency added to library'
            });
        }

        if (this.state.activeProblems.length < Math.ceil(this.config.problemsPerGeneration / 2)) {
            this.reseedProblems();
        }
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

    public getState(): ErdosState {
        return this.state;
    }

    public serialize(): string {
        return JSON.stringify(this.state);
    }

    public deserialize(state: string): void {
        this.state = JSON.parse(state) as ErdosState;
    }

    public getEvents(): ScenarioEvent[] {
        return [...this.eventQueue];
    }

    public clearEvents(): void {
        this.eventQueue = [];
    }
}
