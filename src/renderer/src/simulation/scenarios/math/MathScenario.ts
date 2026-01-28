
import {
    Scenario,
    ScenarioMetadata,
    ControlSignal,
    TelemetryPoint,
    ScenarioEvent
} from '../../types';
import { PRNG } from '../../../common/prng';
import { MathState, MathConfig, DEFAULT_MATH_CONFIG, MathClaim } from './MathTypes';
import { MathTaskGenerator } from './TaskGenerator';
import { MathAgent } from './MathAgent';

export class MathScenario implements Scenario<MathConfig> {
    public metadata: ScenarioMetadata = {
        id: 'math',
        name: 'Mathematical Challenge Arena',
        description: 'Agents evolve to solve algebraic problems and generate novel conjectures.',
        version: '0.2.0',
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
        this.state = this.getEmptyState();
    }

    private getEmptyState(): MathState {
        return {
            generation: 0,
            agents: [],
            currentTasks: [],
            claims: [],
            metrics: {
                C: 0, D: 0, A: 0, U: 0, alertRate: 0,
                avgNovelty: 0,
                totalProvenTheorems: 0,
                falsificationRate: 0
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
            claims: [],
            metrics: {
                C: 0.1, D: 0.8, A: 0, U: 0, alertRate: 0,
                avgNovelty: 0, totalProvenTheorems: 0, falsificationRate: 0
            }
        };

        this.eventQueue = [];
    }

    public updateConfig(config: Partial<MathConfig>) {
        this.config = { ...this.config, ...config };
    }

    public step(control: ControlSignal) {
        this.currentU = control.U;
        this.state.generation += 1;

        // 1. Generate Standard Tasks (Curriculum)
        if (this.state.generation % 1 === 0) {
            this.state.currentTasks = [];
            for (let i = 0; i < this.config.tasksPerGen; i++) {
                this.state.currentTasks.push(this.taskGenerator.generate(control.U));
            }
        }

        // 2. Evaluate Population
        let totalSolved = 0;
        const agentObjects = this.state.agents.map(g => new MathAgent(g));

        // Metrics processing
        let claimsGeneratedThisGen = 0;
        let proofsFoundThisGen = 0;

        // Score each agent
        const scores = agentObjects.map(agent => {
            let score = 0;

            // A. Solve Standard Tasks
            let solved = 0;
            this.state.currentTasks.forEach(task => {
                const ans = agent.solve(task, this.prng);
                if (this.taskGenerator.validate(task, ans)) {
                    solved++;
                }
            });
            agent.genome.solvedCount = solved;
            totalSolved += solved;
            score += solved * 1.0; // Base score

            // B. NCG: Generate Claims (if enabled)
            if (this.config.enableTheorems) {
                // Chance to generate claim based on 'complexity' trait
                // Higher U -> More need for new theorems?
                if (this.prng.next() < 0.2 + (control.U * 0.5)) {
                    const claim = agent.generateClaim(this.prng, control.U);

                    // Assess Novelty (Distance from existing claims)
                    // MVP: Just by string uniqueness
                    const claimStr = claim.text;
                    const isUnique = !this.state.claims.some(c => c.text === claimStr);

                    if (isUnique) {
                        claim.noveltyScore = 1.0; // High novelty for new claim
                        this.state.claims.push(claim);
                        score += 5.0; // Bonus for creativity

                        this.eventQueue.push({
                            type: 'custom',
                            timestamp: this.state.generation,
                            data: { claim: claim.text, agent: agent.genome.id },
                            message: `New Conjecture: ${claim.text}`
                        });
                        claimsGeneratedThisGen++;
                    } else {
                        // Rediscovery
                        claim.noveltyScore = 0.1;
                    }
                }

                // C. NCG: Prove Claims
                // Pick a random unproven claim to work on
                const unproven = this.state.claims.filter(c => !c.proven);
                if (unproven.length > 0) {
                    const target = unproven[this.prng.nextInt(0, unproven.length)];
                    const proof = agent.prove(target, this.prng);

                    if (proof && proof.isValid) {
                        target.proven = true;
                        target.proof = proof;
                        score += 10.0; // Big bonus for proof
                        proofsFoundThisGen++;

                        this.eventQueue.push({
                            type: 'task_solved', // Reusing type
                            timestamp: this.state.generation,
                            data: { claim: target.text, agent: agent.genome.id },
                            message: `THEOREM PROVEN: ${target.text}`
                        });
                    } else {
                        // Failed proof attempt
                        // Did they find a counter-example?
                        if (proof === undefined) {
                            // Implicitly found counter-example in checkTruth
                            // Implementation detail: agent.prove returns undefined if checkTruth fails
                            // We could make this explicit in `prove` return type for full fidelity
                        }
                    }
                }
            }

            return { agent, score };
        });

        // 3. Selection & Reproduction (Simple Elitism)
        scores.sort((a, b) => b.score - a.score);

        const eliteCount = Math.floor(this.config.populationSize * 0.2);
        const elites = scores.slice(0, eliteCount).map(s => s.agent);

        const nextGen: any[] = [];
        elites.forEach(e => nextGen.push(e.genome));

        while (nextGen.length < this.config.populationSize) {
            const parent = elites[this.prng.nextInt(0, elites.length)];
            const child = parent.mutate(this.prng);
            nextGen.push(child.genome);
        }

        this.state.agents = nextGen;

        // 4. Update Metrics
        const maxSolves = this.config.populationSize * this.config.tasksPerGen;
        const successRate = totalSolved / Math.max(1, maxSolves);

        // A - Agency
        const newA = successRate;

        // Diversity
        const weights = nextGen.map(g => (g.data as number[])[1]); // use "proof effort" weight
        const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
        const variance = weights.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / weights.length;
        const newD = Math.min(1, Math.sqrt(variance) * 4);

        // Complexity
        // Boost C if we have proven theorems
        const theoremBonus = Math.min(0.5, this.state.claims.filter(c => c.proven).length * 0.05);
        const newC = (control.U * successRate * 0.5) + (mean * 0.2) + theoremBonus;

        // NCG Metrics
        const avgNovelty = this.state.claims.length > 0
            ? this.state.claims.reduce((s, c) => s + c.noveltyScore, 0) / this.state.claims.length
            : 0;

        // Smoothing
        const alpha = 0.1;
        this.state.metrics.A = this.state.metrics.A * (1 - alpha) + newA * alpha;
        this.state.metrics.C = this.state.metrics.C * (1 - alpha) + newC * alpha;
        this.state.metrics.D = this.state.metrics.D * (1 - alpha) + newD * alpha;
        this.state.metrics.U = control.U;

        this.state.metrics.avgNovelty = avgNovelty;
        this.state.metrics.totalProvenTheorems = this.state.claims.filter(c => c.proven).length;

        // Agency Threshold Event
        if (this.state.metrics.A > 0.75) {
            // Rate limit?
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
