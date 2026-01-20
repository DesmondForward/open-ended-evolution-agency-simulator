
import {
    Scenario,
    ScenarioMetadata,
    ControlSignal,
    TelemetryPoint,
    ScenarioEvent
} from '../../types';
import { PRNG } from '../../../common/prng';
import { MathState, MathConfig, DEFAULT_MATH_CONFIG } from './MathTypes';
import { MathTaskGenerator } from './TaskGenerator';
import { MathAgent } from './MathAgent';

export class MathScenario implements Scenario<MathConfig> {
    public metadata: ScenarioMetadata = {
        id: 'math',
        name: 'Mathematical Challenge Arena',
        description: 'Agents evolve to solve algebraic problems of increasing conceptual difficulty.',
        version: '0.1.0',
        type: 'math'
    };

    private state: MathState;
    private config: MathConfig;
    private prng: PRNG;
    private taskGenerator: MathTaskGenerator;
    private eventQueue: ScenarioEvent[] = [];

    // Internal tracking
    private currentU: number = 0;

    constructor() {
        this.prng = new PRNG(Date.now());
        this.taskGenerator = new MathTaskGenerator(Date.now());
        this.config = { ...DEFAULT_MATH_CONFIG };
        this.state = {
            generation: 0,
            agents: [],
            currentTasks: [],
            metrics: {
                C: 0,
                D: 0,
                A: 0,
                U: 0,
                alertRate: 0
            }
        };
    }

    public initialize(seed: number, config?: MathConfig) {
        this.prng.setSeed(seed);
        this.taskGenerator = new MathTaskGenerator(seed);
        if (config) {
            this.config = { ...DEFAULT_MATH_CONFIG, ...config };
        }

        // Initialize Population
        const agents: any[] = [];
        for (let i = 0; i < this.config.populationSize; i++) {
            agents.push(MathAgent.random(this.prng).genome);
        }

        this.state = {
            generation: 0,
            agents: agents,
            currentTasks: [],
            metrics: { C: 0.1, D: 0.8, A: 0, U: 0, alertRate: 0 }
        };

        this.eventQueue = [];
    }

    public updateConfig(config: Partial<MathConfig>) {
        this.config = { ...this.config, ...config };
    }

    public step(control: ControlSignal) {
        this.currentU = control.U;
        this.state.generation += 1; // 1 generation per step in this discrete mode? 
        // Or maybe 0.1 gen per step to match SDE pace? Let's say 1 gen = 1 evolution cycle.

        // 1. Generate Tasks
        if (this.state.generation % 1 === 0) {
            this.state.currentTasks = [];
            for (let i = 0; i < this.config.tasksPerGen; i++) {
                this.state.currentTasks.push(this.taskGenerator.generate(control.U));
            }
        }

        // 2. Evaluate Population
        let totalSolved = 0;
        const agentObjects = this.state.agents.map(g => new MathAgent(g));
        const eliteAgents: MathAgent[] = [];

        // Score each agent
        const scores = agentObjects.map(agent => {
            let solved = 0;
            this.state.currentTasks.forEach(task => {
                const ans = agent.solve(task, this.prng);
                if (this.taskGenerator.validate(task, ans)) {
                    solved++;
                }
            });
            agent.genome.solvedCount = solved;
            totalSolved += solved;
            return { agent, score: solved };
        });

        // 3. Selection & Reproduction (Simple Elitism)
        scores.sort((a, b) => b.score - a.score);

        // Keep top 20%
        const eliteCount = Math.floor(this.config.populationSize * 0.2);
        const elites = scores.slice(0, eliteCount).map(s => s.agent);

        // Fill rest with mutated children of elites
        const nextGen: any[] = [];
        // Add elites
        elites.forEach(e => nextGen.push(e.genome));

        while (nextGen.length < this.config.populationSize) {
            const parent = elites[this.prng.nextInt(0, elites.length)];
            const child = parent.mutate(this.prng);
            nextGen.push(child.genome);
        }

        this.state.agents = nextGen;

        // 4. Update Metrics (C, D, A)

        // Agency (A): Success rate relative to difficulty
        // Maximum possible solves = popSize * tasksPerGen
        const maxSolves = this.config.populationSize * this.config.tasksPerGen;
        const successRate = totalSolved / Math.max(1, maxSolves);

        // A grows if successRate is high AND U is high
        // A = successRate * (0.5 + 0.5 * U) ? Or just Success Rate?
        // PRD says A is efficacy at high U.
        const newA = successRate;

        // Diversity (D): Variance in genome weights
        // Simple proxy: std dev of the "smart weight"
        const weights = nextGen.map(g => (g.data as number[])[1]);
        const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
        const variance = weights.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / weights.length;
        // Normalize D somewhat 
        const newD = Math.min(1, Math.sqrt(variance) * 4); // Scale up

        // Complexity (C): Complexity of the tasks being solved + Genome complexity
        // If they are solving hard tasks (high U), C is high.
        // C = U * SuccessRate + Baseline
        const newC = (control.U * successRate * 0.8) + (mean * 0.2);

        // Update State Metrics
        // Simple smoothing
        const alpha = 0.1;
        this.state.metrics.A = this.state.metrics.A * (1 - alpha) + newA * alpha;
        this.state.metrics.C = this.state.metrics.C * (1 - alpha) + newC * alpha;
        this.state.metrics.D = this.state.metrics.D * (1 - alpha) + newD * alpha;
        this.state.metrics.U = control.U;

        // Check for Events (Agency Threshold)
        if (this.state.metrics.A > 0.75) {
            // Only fire if not recently fired? Handled by runner/store usually, but we can queue it.
            this.eventQueue.push({
                type: 'threshold_crossed',
                timestamp: this.state.generation,
                data: { A: this.state.metrics.A },
                message: "Agency > 0.75: High performance solvers detected."
            });
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

    public getState(): any {
        return this.state;
    }

    public serialize(): string {
        return JSON.stringify({
            state: this.state,
            config: this.config,
            currentU: this.currentU
            // PRNG state? Setup deterministic seed to replay.
        });
    }

    public deserialize(json: string): void {
        const data = JSON.parse(json);
        this.state = data.state;
        this.config = data.config;
        this.currentU = data.currentU;
    }

    public getEvents(): ScenarioEvent[] {
        return [...this.eventQueue];
    }

    public clearEvents(): void {
        this.eventQueue = [];
    }
}
