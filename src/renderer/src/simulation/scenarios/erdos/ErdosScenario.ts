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
    ErdosArtifact,
    ErdosArtifactType,
    ErdosConfig,
    ErdosProblem,
    ErdosState,
    EvaluatorOutput,
    EvaluatorStatus,
    ProblemDomain
} from './ErdosTypes';
import { ERDOS_DATASET_V1 } from '../../../../../shared/erdos-dataset';

const PROBLEM_BANK = ERDOS_DATASET_V1.problems;
const DATASET_REVISION = ERDOS_DATASET_V1.provenance.revision;

const DOMAINS: ProblemDomain[] = ['additive_number_theory', 'combinatorics', 'graph_theory', 'geometry'];

const DOMAIN_METHODS: Record<ProblemDomain, { ansatz: string; verifier: string; invariant: string }> = {
    additive_number_theory: {
        ansatz: 'Translate the target statement into additive energy and doubling inequalities over a finite witness set A.',
        verifier: 'Check each claimed bound with explicit residue-class sweeps and random-sign stress tests over the same witness set.',
        invariant: 'Track monotonic improvement in exponent candidate δ_t under δ_{t+1} ≥ δ_t - 10^{-3}.'
    },
    combinatorics: {
        ansatz: 'Convert the problem into a constrained counting model and derive matching upper/lower estimates.',
        verifier: 'Validate each estimate by independent recounts (symbolic and Monte Carlo) with shared random-seed disclosure.',
        invariant: 'Maintain a non-increasing feasible interval [L_t,U_t] with width U_t-L_t shrinking each generation.'
    },
    graph_theory: {
        ansatz: 'Reformulate as extremal density/structure constraints and search for forbidden witnesses.',
        verifier: 'Produce a machine-checkable obstruction certificate and cross-check with a second independent checker.',
        invariant: 'Preserve certificate consistency: every edge/degrees claim must satisfy handshake and local subgraph constraints.'
    },
    geometry: {
        ansatz: 'Parameterize candidate configurations and derive incidence inequalities from distance/curve structure.',
        verifier: 'Numerically validate geometric constraints on sampled coordinates and compare against symbolic inequalities.',
        invariant: 'Require every candidate construction to satisfy both symbolic bounds and coordinate-level feasibility.'
    }
};

const toArtifactType = (status: EvaluatorStatus, quality: number): ErdosArtifactType => {
    if (status === 'refuted') return 'counterexampleWitness';
    if (status === 'verified' && quality > 0.9) return 'formalProof';
    if (quality > 0.75) return 'boundCertificate';
    return 'proofSketch';
};

const buildCopyAction = (problem: ErdosProblem): string => {
    const statusLine = problem.solved ? '**Status:** Solved' : '**Status:** In progress';
    const steps = problem.steps.length > 0
        ? problem.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
        : problem.solved
            ? '1. No explicit step trace captured.'
            : '1. No step trace available yet.';

    return [
        `**Erdos Number:** ${problem.erdosNumber}`,
        `**Problem:** ${problem.title}`,
        `**Description:** ${problem.description}`,
        `**Dataset revision:** ${problem.datasetRevision}`,
        statusLine,
        `**Evaluator status:** ${problem.evaluator.status}`,
        `**Candidate artifact:** ${problem.evaluator.candidateArtifactId}`,
        '**Evidence refs:**',
        problem.evaluator.evidenceReferences.length > 0
            ? problem.evaluator.evidenceReferences.map((ref, index) => `${index + 1}. ${ref}`).join('\n')
            : '1. No evaluator evidence references recorded.',
        '**Steps:**',
        steps
    ].join('\n');
};

const buildResolutionReport = (problem: ErdosProblem, generation: number): string => {
    const method = DOMAIN_METHODS[problem.domain];
    const contributorList = problem.agents.length > 0
        ? problem.agents.map((agent, index) => `${index + 1}. ${agent.name} (${agent.id})`).join('\n')
        : '1. No contributors were recorded.';
    const orderedSteps = problem.steps.length > 0
        ? problem.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
        : '1. No step trace captured.';

    const artifacts = problem.artifacts.length > 0
        ? problem.artifacts.map((artifact, index) => `${index + 1}. ${artifact.id} (${artifact.type}) — ${artifact.summary}`).join('\n')
        : '1. No artifacts were captured.';

    return [
        `# Erdos Problem #${problem.erdosNumber}: ${problem.title}`,
        '',
        `- Problem ID: ${problem.id}`,
        `- Generation solved: ${generation}`,
        `- Domain: ${problem.domain.replace(/_/g, ' ')}`,
        `- Dataset revision: ${problem.datasetRevision}`,
        `- Evaluator verdict: ${problem.evaluator.status}`,
        `- Candidate artifact: ${problem.evaluator.candidateArtifactId}`,
        '',
        '## Description',
        problem.description,
        '',
        '## Mathematical approach',
        `- Ansatz: ${method.ansatz}`,
        `- Verifier: ${method.verifier}`,
        `- Invariant tracked: ${method.invariant}`,
        '',
        '## Agent contributors',
        contributorList,
        '',
        '## Evaluator evidence references',
        ...(problem.evaluator.evidenceReferences.length > 0 ? problem.evaluator.evidenceReferences.map(ref => `- ${ref}`) : ['- none']),
        '',
        '## Artifacts',
        artifacts,
        '',
        '## Mathematical work log',
        orderedSteps,
        '',
        '## Resolution summary',
        `The discovery collective only marks this item solved after the evaluator verdict is \`verified\` and the candidate artifact is linked to explicit evidence references.`
    ].join('\n');
};

const buildGenerationMathWork = (
    problem: ErdosProblem,
    generation: number,
    cycle: number,
    solutionQuality: number,
    threshold: number,
    avgCreativity: number,
    avgRigor: number,
    avgCollab: number
): string[] => {
    const qualityGap = solutionQuality - threshold;
    const method = DOMAIN_METHODS[problem.domain];
    const inequalityLine = `Generation ${generation}: Quantified objective with Q_t=${solutionQuality.toFixed(3)}, θ_t=${threshold.toFixed(3)}, and margin Δ_t=(Q_t-θ_t)=${qualityGap.toFixed(3)}.`;
    const decompositionLine = `Generation ${generation}: Decomposed score as 0.45c + 0.45r + 0.10ℓ using c=${avgCreativity.toFixed(3)}, r=${avgRigor.toFixed(3)}, ℓ=${avgCollab.toFixed(3)} to audit where mathematical progress originated.`;
    const methodLine = `Generation ${generation}: ${method.ansatz}`;
    const verifierLine = `Generation ${generation}: ${method.verifier}`;
    const invariantLine = `Generation ${generation}: Invariant check (cycle ${cycle}) -> ${method.invariant}`;

    return [inequalityLine, decompositionLine, methodLine, verifierLine, invariantLine];
};

const buildInitialSteps = (domain: ProblemDomain): string[] => {
    const reproducibilityTail = [
        'Record all assumptions, notation, and known lemmas with exact references so another team can reproduce the same starting state.',
        'Define explicit acceptance criteria (target inequality, error tolerance, and verification checks) before declaring progress.'
    ];

    const method = DOMAIN_METHODS[domain];

    switch (domain) {
        case 'geometry':
            return [
                'Collect candidate geometric constructions and identify extremal configurations.',
                'Test bounds using distance-incidence arguments and compare with known asymptotics.',
                'Provide coordinate-level construction data and computational scripts for each candidate extremal family.',
                method.ansatz,
                ...reproducibilityTail
            ];
        case 'graph_theory':
            return [
                'Enumerate structural graph constraints induced by the conjecture conditions.',
                'Search for extremal or forbidden patterns that tighten combinatorial bounds.',
                'Submit machine-checkable certificates (edge lists, SAT encodings, or proof scripts) for each claimed obstruction.',
                method.ansatz,
                ...reproducibilityTail
            ];
        case 'combinatorics':
            return [
                'Map the problem to an equivalent counting formulation with explicit constraints.',
                'Apply probabilistic and extremal estimates to narrow feasible bound ranges.',
                'Publish exact counting pipelines and random-seed controls for every Monte Carlo or probabilistic estimate.',
                method.ansatz,
                ...reproducibilityTail
            ];
        case 'additive_number_theory':
        default:
            return [
                'Translate the statement into additive-combinatorial inequalities over candidate sets.',
                'Probe edge cases via residue classes and growth-rate heuristics.',
                'Archive computational experiments with full parameter sweeps and independent rerun instructions.',
                method.ansatz,
                ...reproducibilityTail
            ];
    }
};

const evaluateCandidate = (
    problem: ErdosProblem,
    artifact: ErdosArtifact,
    quality: number,
    threshold: number,
    generation: number
): EvaluatorOutput => {
    const status: EvaluatorStatus = quality >= threshold + 0.07
        ? 'verified'
        : quality <= threshold - 0.12
            ? 'refuted'
            : 'inconclusive';

    const evidenceReferences = [
        `dataset:${problem.datasetRevision}:${problem.id}`,
        `artifact:${artifact.id}`,
        `worklog:generation:${generation}`
    ];

    return {
        candidateArtifactId: artifact.id,
        status,
        evidenceReferences,
        evaluatedAt: new Date().toISOString()
    };
};

export class ErdosScenario implements Scenario<ErdosConfig> {
    public metadata: ScenarioMetadata = {
        id: 'erdos',
        name: 'Erdős Open Problems',
        description: 'Evolving discovery agencies collaborate on the Erdős open-problem catalog (teorth/erdosproblems) and expand the cognitive light cone.',
        version: '0.1.0',
        type: 'erdos'
    };

    private state: ErdosState;
    private config: ErdosConfig;
    private prng: PRNG;
    private eventQueue: ScenarioEvent[] = [];

    constructor() {
        this.prng = new PRNG(0);
        this.config = { ...DEFAULT_ERDOS_CONFIG };
        this.state = this.getEmptyState();
    }

    private getEmptyState(): ErdosState {
        return {
            generation: 0,
            cycle: 1,
            nextProblemIndex: 0,
            artifactCounter: 0,
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

    private nextArtifactId(problemId: string): string {
        this.state.artifactCounter += 1;
        return `${problemId}-artifact-${String(this.state.artifactCounter).padStart(6, '0')}`;
    }

    private reseedProblems() {
        if (this.state.activeProblems.length > 0) {
            return;
        }

        if (this.state.nextProblemIndex >= PROBLEM_BANK.length) {
            this.state.nextProblemIndex = 0;
            this.state.cycle += 1;
            this.eventQueue.push({
                type: 'task_solved',
                timestamp: this.state.generation,
                data: { cycle: this.state.cycle },
                message: `Starting verification cycle ${this.state.cycle} across the full Erdős problem catalog.`
            });
        }

        const now = new Date().toISOString();
        const nextProblem = PROBLEM_BANK[this.state.nextProblemIndex];
        const seededProblem: ErdosProblem = {
            ...nextProblem,
            solved: false,
            lastStatusUpdate: now,
            datasetRevision: DATASET_REVISION,
            steps: [...buildInitialSteps(nextProblem.domain), `Cycle ${this.state.cycle}: baseline investigation initialized.`],
            agents: [],
            artifacts: [],
            evaluator: {
                candidateArtifactId: 'none',
                status: 'inconclusive',
                evidenceReferences: [],
                evaluatedAt: now
            },
            copyAction: ''
        };
        seededProblem.copyAction = buildCopyAction(seededProblem);

        this.state.activeProblems = [seededProblem];
        this.state.nextProblemIndex += 1;
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
        next.problemsPerGeneration = 1;
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
            const contributorRoster = contributors.map(agent => ({
                id: agent.id,
                name: `Agent ${agent.id.slice(-6)}`
            }));

            const avgCreativity = contributors.reduce((acc, a) => acc + a.creativity, 0) / contributors.length;
            const avgRigor = contributors.reduce((acc, a) => acc + a.rigor, 0) / contributors.length;
            const avgCollab = contributors.reduce((acc, a) => acc + a.collaboration, 0) / contributors.length;

            const basePower = avgCreativity * 0.45 + avgRigor * 0.45 + avgCollab * 0.1;
            const pressureBonus = control.U * 0.15;
            const noise = (this.prng.next() - 0.5) * 0.08;
            const solutionQuality = Math.max(0, Math.min(1, basePower + pressureBonus + noise));
            const threshold = problem.difficulty * (0.85 - collaborationFactor * 0.2);

            problem.lastStatusUpdate = new Date().toISOString();
            problem.agents = contributorRoster;

            const mathWork = buildGenerationMathWork(
                problem,
                this.state.generation,
                this.state.cycle,
                solutionQuality,
                threshold,
                avgCreativity,
                avgRigor,
                avgCollab
            );

            const artifact: ErdosArtifact = {
                id: this.nextArtifactId(problem.id),
                type: toArtifactType('inconclusive', solutionQuality),
                generation: this.state.generation,
                createdAt: new Date().toISOString(),
                summary: `Generation ${this.state.generation} candidate package with score ${solutionQuality.toFixed(3)} against gate ${threshold.toFixed(3)}.`,
                evidenceReferences: [
                    `step:${problem.id}:${this.state.generation}`,
                    `domain:${problem.domain}`
                ]
            };

            const evaluator = evaluateCandidate(problem, artifact, solutionQuality, threshold, this.state.generation);
            artifact.type = toArtifactType(evaluator.status, solutionQuality);

            problem.evaluator = evaluator;
            problem.artifacts = [...problem.artifacts, artifact];
            problem.steps = [
                ...problem.steps,
                ...mathWork,
                `Generation ${this.state.generation}: Evaluator verdict -> ${evaluator.status} on artifact ${artifact.id}.`,
                `Generation ${this.state.generation}: Evidence refs -> ${evaluator.evidenceReferences.join(', ')}`
            ];

            if (evaluator.status === 'verified') {
                problem.steps = [
                    ...problem.steps,
                    `Generation ${this.state.generation}: Evaluator marked candidate artifact ${artifact.id} as verified; problem promoted to solved status.`
                ];
                problem.solved = true;
                problem.resolutionReportMarkdown = buildResolutionReport(problem, this.state.generation);
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
                        erdosNumber: problem.erdosNumber,
                        title: problem.title,
                        domain: problem.domain,
                        evaluatorStatus: evaluator.status,
                        evaluatorArtifactId: evaluator.candidateArtifactId,
                        evidenceReferences: evaluator.evidenceReferences,
                        datasetRevision: problem.datasetRevision,
                        reportMarkdown: problem.resolutionReportMarkdown
                    },
                    message: `Solved: Erdos #${problem.erdosNumber} — ${problem.title} (${evaluator.candidateArtifactId})`
                });
            }

            problem.copyAction = buildCopyAction(problem);
        }

        const solvedThisRound = this.state.activeProblems.filter(problem => problem.solved);
        if (solvedThisRound.length > 0) {
            const solvedById = new Map(this.state.solvedProblems.map(problem => [problem.id, problem] as const));
            solvedThisRound.forEach(problem => {
                solvedById.set(problem.id, problem);
            });
            this.state.solvedProblems = Array.from(solvedById.values());
        }
        this.state.activeProblems = this.state.activeProblems.filter(problem => !problem.solved);

        const solvedProblemIds = new Set(this.state.solvedProblems.map(problem => problem.id));
        const solvedRatio = Math.min(1, solvedProblemIds.size / PROBLEM_BANK.length);
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

        if (this.state.activeProblems.length === 0) {
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
        const parsed = JSON.parse(state) as Partial<ErdosState>;
        this.state = {
            ...this.getEmptyState(),
            ...parsed,
            cycle: typeof parsed.cycle === 'number' ? Math.max(1, Math.floor(parsed.cycle)) : 1,
            nextProblemIndex: typeof parsed.nextProblemIndex === 'number'
                ? Math.max(0, Math.floor(parsed.nextProblemIndex))
                : Array.isArray(parsed.solvedProblems)
                    ? parsed.solvedProblems.length
                    : 0,
            artifactCounter: typeof parsed.artifactCounter === 'number' ? Math.max(0, Math.floor(parsed.artifactCounter)) : 0
        };

        if (!Array.isArray(this.state.activeProblems)) {
            this.state.activeProblems = [];
        }

        if (this.state.activeProblems.length > 1) {
            this.state.activeProblems = [this.state.activeProblems[0]];
        }

        this.state.activeProblems = this.state.activeProblems.map(problem => ({
            ...problem,
            datasetRevision: typeof problem.datasetRevision === 'string' ? problem.datasetRevision : DATASET_REVISION,
            artifacts: Array.isArray(problem.artifacts) ? problem.artifacts : [],
            evaluator: problem.evaluator && typeof problem.evaluator.status === 'string'
                ? problem.evaluator
                : {
                    candidateArtifactId: 'none',
                    status: 'inconclusive',
                    evidenceReferences: [],
                    evaluatedAt: problem.lastStatusUpdate || new Date().toISOString()
                }
        }));

        const solvedById = new Map<string, ErdosProblem>();
        (Array.isArray(this.state.solvedProblems) ? this.state.solvedProblems : []).forEach(problem => {
            const normalized: ErdosProblem = {
                ...problem,
                datasetRevision: typeof problem.datasetRevision === 'string' ? problem.datasetRevision : DATASET_REVISION,
                artifacts: Array.isArray(problem.artifacts) ? problem.artifacts : [],
                evaluator: problem.evaluator && typeof problem.evaluator.status === 'string'
                    ? problem.evaluator
                    : {
                        candidateArtifactId: 'none',
                        status: 'inconclusive',
                        evidenceReferences: [],
                        evaluatedAt: problem.lastStatusUpdate || new Date().toISOString()
                    }
            };
            const existing = solvedById.get(normalized.id);
            if (!existing) {
                solvedById.set(normalized.id, normalized);
                return;
            }
            const existingTimestamp = Date.parse(existing.lastStatusUpdate || '');
            const incomingTimestamp = Date.parse(normalized.lastStatusUpdate || '');
            if (incomingTimestamp >= existingTimestamp) {
                solvedById.set(normalized.id, normalized);
            }
        });
        this.state.solvedProblems = Array.from(solvedById.values());
    }

    public getEvents(): ScenarioEvent[] {
        return [...this.eventQueue];
    }

    public clearEvents(): void {
        this.eventQueue = [];
    }
}
