
import {
    Scenario,
    ScenarioMetadata,
    ControlSignal,
    TelemetryPoint,
    ScenarioEvent
} from '../../types';
import { PRNG } from '../../../common/prng';
import { MathState, MathConfig, DEFAULT_MATH_CONFIG, MathClaim } from './MathTypes';
import { AdversarialTaskGenerator, AdversarialGeneratorState, computePopulationStats } from './AdversarialTaskGenerator';
import { MathAgent } from './MathAgent';
import { getFormalVerificationService } from './FormalVerificationService';
import { ASTGenomeFactory } from './ASTGenome';
import { RunContext, RunContextState } from '../../RunContext';

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
    private taskGenerator: AdversarialTaskGenerator;
    private eventQueue: ScenarioEvent[] = [];
    private previousAgency: number = 0;
    private runContext: RunContext;

    // Internal tracking
    private currentU: number = 0;

    constructor() {
        this.runContext = new RunContext(0);
        this.prng = this.runContext.getPrng();
        this.taskGenerator = new AdversarialTaskGenerator(this.runContext);
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
        this.runContext = new RunContext(seed);
        this.prng = this.runContext.getPrng();
        this.taskGenerator = new AdversarialTaskGenerator(this.runContext);
        if (config) {
            this.config = { ...DEFAULT_MATH_CONFIG, ...config };
        }

        // Initialize Population
        const agents: any[] = [];
        for (let i = 0; i < this.config.populationSize; i++) {
            // SOTA Recommendation: Use Neuro-Symbolic Agents (AST)
            agents.push(MathAgent.random(this.prng, true, this.runContext).genome);
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
        const next = { ...this.config, ...config };
        if (!Number.isFinite(next.populationSize) || next.populationSize < 1) {
            next.populationSize = 1;
        }
        if (!Number.isFinite(next.tasksPerGen) || next.tasksPerGen < 1) {
            next.tasksPerGen = 1;
        }
        next.populationSize = Math.floor(next.populationSize);
        next.tasksPerGen = Math.floor(next.tasksPerGen);
        this.config = next;
    }

    public step(control: ControlSignal) {
        this.currentU = control.U;
        this.state.generation += 1;
        this.runContext.tick();

        // 1. Generate Standard Tasks (Curriculum) - PAIRED
        if (this.state.generation % 1 === 0) {
            // Compute stats for adversarial generation
            const solveRates = this.state.agents.map(a => a.solvedCount / Math.max(1, this.config.tasksPerGen));
            const popStats = computePopulationStats(solveRates, this.state.agents);

            this.state.currentTasks = [];
            for (let i = 0; i < this.config.tasksPerGen; i++) {
                this.state.currentTasks.push(this.taskGenerator.generate(popStats));
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
                // Simple validation for PAIRED
                // We check if abs(ans - target) < epsilon
                let isCorrect = false;
                if (task.targetValue !== undefined) {
                    isCorrect = Math.abs(ans - task.targetValue) < 0.001;
                }

                if (isCorrect) {
                    solved++;
                    // Feedback to generator
                    this.taskGenerator.recordPerformance(task, 1.0);
                } else {
                    this.taskGenerator.recordPerformance(task, 0.0);
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

                    // FORMAL VERIFICATION INTERGRATION
                    // Instead of the agent "proving" it (which was just random + effort),
                    // we actually check it against the formal verifier.
                    // The agent's role is to FIND the theorem, the system verifies it.

                    // Optimization: Only verify if the agent is high-quality enough to likely be correct
                    // or if we have budget.

                    const verifier = getFormalVerificationService();

                    // Note: verify is async, but step() is sync.
                    // For now we assume mock verification which is fast, or we fire-and-forget
                    // In a robust engine we'd await this or queue it.
                    // We'll treat it as a promise but since we are in a sync loop we might miss it this tick
                    // For this implementation we will force a sync-like behavior or just let it handle in background

                    const verificationGeneration = this.state.generation;
                    verifier.verify(target).then(result => {
                        if (result.verified) {
                            target.proven = true;

                            // DISCOVERY: Find the author and credit them
                            const author = this.state.agents.find(a => a.id === target.authorId);
                            if (author) {
                                author.theoremsProven++;
                                author.complexityScore += 0.5; // Persistent boost

                                // Agent Discovered!
                                this.eventQueue.push({
                                    type: 'agent_emerged',
                                    timestamp: verificationGeneration,
                                    data: {
                                        id: author.id,
                                        timestamp: new Date().toISOString(),
                                        name: `Math-Agent-${author.id.substring(0, 5)}`,
                                        description: `Formal Proof Verified (Backend: ${result.backend}) for: ${target.text}`,
                                        tags: ['Math-Agent', 'Prover', 'Formal-Verification'],
                                        generation: verificationGeneration,
                                        metrics: { ...this.state.metrics },
                                        parameters: { ...this.config, genome: author }, // Serialize the genome
                                        environmentalControl: { U: this.state.metrics.U },
                                        runContext: { bestAgencySoFar: this.state.metrics.A }
                                    },
                                    message: `Agent ${author.id.substring(0, 5)} formally proved a theorem!`
                                });
                            }

                            this.eventQueue.push({
                                type: 'task_solved',
                                timestamp: verificationGeneration,
                                data: { claim: target.text, agent: target.authorId, backend: result.backend },
                                message: `THEOREM PROVEN (${result.backend}): ${target.text}`
                            });
                        }
                    });

                    // Legacy "agent.prove()" call to simulate effort/cost
                    const proof = agent.prove(target, this.prng);
                    if (proof && proof.isValid) {
                        // We give immediate credit for "finding a proof path"
                        score += 10.0;
                        proofsFoundThisGen++;

                        // Log this agent as it found a proof!
                        this.eventQueue.push({
                            type: 'agent_emerged',
                            timestamp: this.state.generation,
                            data: {
                                id: agent.genome.id,
                                timestamp: new Date().toISOString(),
                                name: `Math-Agent-${agent.genome.id.substring(0, 5)}`,
                                description: `Math Agent found proof for: ${target.text.substring(0, 30)}...`,
                                tags: ['Math-Agent', 'Prover'],
                                generation: this.state.generation,
                                metrics: {
                                    A: this.state.metrics.A,
                                    C: this.state.metrics.C,
                                    D: this.state.metrics.D,
                                    alertRate: this.state.metrics.alertRate
                                },
                                parameters: { ...this.config, genome: agent.genome },
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
                            message: "Agent Proved Theorem - Added to Library"
                        });
                    }
                }
            }

            return { agent, score };
        });

        // 3. Selection & Reproduction (Simple Elitism)
        scores.sort((a, b) => b.score - a.score);

        const eliteCount = Math.max(1, Math.floor(this.config.populationSize * 0.2));
        const elites = scores.slice(0, Math.min(eliteCount, scores.length)).map(s => s.agent);

        const nextGen: any[] = [];
        elites.forEach(e => nextGen.push(e.genome));

        if (elites.length === 0) {
            for (let i = 0; i < this.config.populationSize; i++) {
                nextGen.push(MathAgent.random(this.prng, true, this.runContext).genome);
            }
            this.state.agents = nextGen;
            return;
        }

        // Async Mutation Handling (LLM)
        // Since step() is synchronous, we'll do best-effort sync mutation here
        // and trigger async LLM mutation for the NEXT frame if possible.
        // For simplicity in this loop, we stick to sync mutation but call the factory method
        // which has a fallback.

        // We will perform standard mutation for now, but if we wanted LLM we'd need to make step() async
        // or have a "pending agents" queue.

        while (nextGen.length < this.config.populationSize) {
            const parent = elites[this.prng.nextInt(0, elites.length)];

            // Standard mutation (MathAgent.mutate -> wrapper around factory)
            const child = parent.mutate(this.prng);
            nextGen.push(child.genome);

            // Opportunity to sprinkle in LLM mutation if enabled?
            // This would require a major refactor to async-await the whole engine loop
            // or managing promises. 
        }

        this.state.agents = nextGen;

        // 4. Update Metrics
        const maxSolves = this.config.populationSize * this.config.tasksPerGen;
        const successRate = totalSolved / Math.max(1, maxSolves);

        // A - Agency
        const newA = successRate;

        // Diversity
        const weights = nextGen.map(g => {
            if (g.type === 'ast') return g.complexityScore;
            return (g.data as number[])[1]; // use "proof effort" weight
        });
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
        const dA = this.state.metrics.A - (this.previousAgency || 0);
        this.previousAgency = this.state.metrics.A;

        // SOTA Recommendation: Dynamic Timing & Saturation Detection
        // If we are in the critical window (Gen > 500) and saturated (High A, Low dA)
        if (this.state.generation > 500 && this.state.metrics.A > 0.95 && Math.abs(dA) < 0.001) {
            // Check if we already intervened recently
            const lastIntervention = this.eventQueue.filter(e => e.type === 'custom' && e.message.includes('MASS EXTINCTION')).pop();
            const lastGen = lastIntervention ? lastIntervention.timestamp : 0;

            if (this.state.generation - lastGen > 200) {
                // INTERVENTION: Mass Extinction
                // Keep top 5% elites, replace rest with fresh random AST agents
                const survivors = this.state.agents.slice(0, Math.floor(this.config.populationSize * 0.05));
                while (survivors.length < this.config.populationSize) {
                    survivors.push(MathAgent.random(this.prng, true, this.runContext).genome);
                }
                this.state.agents = survivors;

                this.eventQueue.push({
                    type: 'custom',
                    timestamp: this.state.generation,
                    data: { dA, A: this.state.metrics.A },
                    message: 'CRITICAL SATURATION DETECTED: TRIGGERING MASS EXTINCTION'
                });
            }
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
            currentU: this.currentU,
            runContext: this.runContext.getState(),
            taskGeneratorState: this.taskGenerator.getDeterministicState()
        });
    }

    public deserialize(json: string): void {
        const data = JSON.parse(json);
        this.state = data.state;
        this.config = data.config;
        this.currentU = data.currentU;
        const runContextState = data.runContext as RunContextState | undefined;
        const seed = runContextState?.seed ?? 0;
        this.runContext = new RunContext(seed);
        if (runContextState) {
            this.runContext.restore(runContextState);
        }
        this.runContext.setTick(this.state.generation);
        this.prng = this.runContext.getPrng();
        this.taskGenerator = new AdversarialTaskGenerator(this.runContext);
        const taskGeneratorState = data.taskGeneratorState as AdversarialGeneratorState | undefined;
        if (taskGeneratorState) {
            this.taskGenerator.restoreDeterministicState(taskGeneratorState);
        }
    }

    public getEvents(): ScenarioEvent[] {
        return [...this.eventQueue];
    }

    public clearEvents(): void {
        this.eventQueue = [];
    }
}
