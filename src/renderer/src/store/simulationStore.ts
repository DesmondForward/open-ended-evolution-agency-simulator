
import { create } from 'zustand';
import {
    SimulationState,
    SimulationParameters,
    ControlSignal,
    TelemetryPoint,
    AlertEvent,
    DEFAULT_INITIAL_STATE,
    DEFAULT_PARAMETERS,
    DEFAULT_CONTROL,
    ValidationMetrics,
    AIHistoryEntry,
    ScenarioMetadata,
    InterventionLogEntry,
    ScenarioEvent
} from '../simulation/types';
import { fetchAIControl, generateAgentDescription } from '../services/aiService';
import { LibraryEntry, LegacyAgent, LIBRARY_SCHEMA_VERSION } from '../../../shared/agentLibrary';
import { ScenarioRunner } from '../simulation/runner/ScenarioRunner';
import { SDEScenario } from '../simulation/scenarios/sde/SDEScenario';
import { MathScenario } from '../simulation/scenarios/math/MathScenario';
import { AlignmentScenario } from '../simulation/scenarios/alignment/AlignmentScenario';
import { BioScenario } from '../simulation/scenarios/bio/BioScenario';
import { AgentsScenario } from '../simulation/scenarios/agents/AgentsScenario';
import { DEFAULT_MATH_CONFIG, MathConfig } from '../simulation/scenarios/math/MathTypes';
import { DEFAULT_ALIGNMENT_CONFIG, AlignmentConfig } from '../simulation/scenarios/alignment/AlignmentTypes';
import { DEFAULT_BIO_CONFIG, BioConfig } from '../simulation/scenarios/bio/BioTypes';
import { DEFAULT_AGENT_CONFIG, AgentConfig } from '../simulation/scenarios/agents/AgentTypes';
import { DEFAULT_ERDOS_CONFIG, ErdosConfig } from '../simulation/scenarios/erdos/ErdosTypes';
import { createSnapshot, parseSnapshot, SnapshotData } from '../simulation/snapshot';
import { ErdosScenario } from '../simulation/scenarios/erdos/ErdosScenario';

interface SimulationStore {
    // State
    isPlaying: boolean;
    currentState: SimulationState;
    parameters: SimulationParameters;
    control: ControlSignal;
    telemetry: TelemetryPoint[];
    alerts: AlertEvent[];
    events: ScenarioEvent[]; // Global event log
    validationMetrics: ValidationMetrics;
    logPersistenceError: string | null;

    // Scenario Management
    currentScenarioId: string;
    scenarioMetadata: ScenarioMetadata;
    availableScenarios: ScenarioMetadata[];
    scenarioConfigs: {
        math: MathConfig;
        alignment: AlignmentConfig;
        bio: BioConfig;
        agents: AgentConfig;
        erdos: ErdosConfig;
    };

    // Agent Library
    savedAgents: LibraryEntry[];

    // AI Control
    isAIControlled: boolean;
    aiStatus: 'idle' | 'thinking' | 'cooldown';
    aiReasoning: string;
    lastAiUpdate: Date | null;
    aiHistory: AIHistoryEntry[];
    interventionLog: InterventionLogEntry[];
    aiError: string | null;

    // Persistence
    bestAgency: number;
    bestParameters: SimulationParameters | null;
    bestControl: ControlSignal | null;
    lastSavedGeneration: number;
    currentRunId: string;
    currentRunSeed: number;

    // Actions
    togglePlay: () => void;
    toggleAIControl: () => void;
    reset: () => void;
    setControl: (U: number) => void;
    updateParameters: (params: Partial<SimulationParameters>) => void;
    updateScenarioConfig: (config: Partial<MathConfig | AlignmentConfig | BioConfig | AgentConfig | ErdosConfig>) => void;
    switchScenario: (id: string) => void;
    loadBestParameters: () => void;
    triggerAI: () => Promise<void>;
    step: () => Promise<void>; // Driven by UI loop or internal runner hooks?
    loadAgents: () => Promise<void>;
    exportState: () => string;
    importState: (json: string) => boolean;
}

// Max telemetry points to keep in memory for charting
const MAX_TELEMETRY_POINTS = 1000;
const MAX_EVENT_LOGS = 100;

// Initialize Scenarios
const sdeScenario = new SDEScenario();
const mathScenario = new MathScenario();
const alignmentScenario = new AlignmentScenario();
const bioScenario = new BioScenario();
const agentsScenario = new AgentsScenario();
const erdosScenario = new ErdosScenario();

const scenarios: Record<string, any> = {
    'sde-v1': sdeScenario,
    'math': mathScenario,
    'alignment': alignmentScenario,
    'bio': bioScenario,
    'agents': agentsScenario,
    'erdos': erdosScenario
};

const getScenarioConfigForId = (
    id: string,
    parameters: SimulationParameters,
    configs: SimulationStore['scenarioConfigs']
) => {
    switch (id) {
        case 'math':
            return configs.math;
        case 'alignment':
            return configs.alignment;
        case 'bio':
            return configs.bio;
        case 'agents':
            return configs.agents;
        case 'erdos':
            return configs.erdos;
        case 'sde-v1':
        default:
            return parameters;
    }
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const ensureNumber = (value: unknown, fallback = 0) => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const ensureOptionalNumber = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const ensureString = (value: unknown, fallback: string) => (
    typeof value === 'string' && value.trim().length > 0 ? value : fallback
);

const ensureStringArray = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const downsampleTelemetry = (points: TelemetryPoint[], maxPoints: number) => {
    if (points.length <= maxPoints) return points;
    const stride = Math.ceil(points.length / maxPoints);
    const sampled: TelemetryPoint[] = [];
    for (let i = 0; i < points.length; i += stride) {
        sampled.push(points[i]);
    }
    return sampled.slice(0, maxPoints);
};

const buildBehaviorTrace = (telemetry: TelemetryPoint[]) => {
    if (!telemetry.length) {
        return { summary: 'No telemetry captured for this emergence window.' };
    }
    const samples = downsampleTelemetry(telemetry, 200);
    const peakA = Math.max(...samples.map(p => p.A));
    const avgA = samples.reduce((sum, p) => sum + p.A, 0) / samples.length;
    const avgU = samples.reduce((sum, p) => sum + p.U, 0) / samples.length;
    const fromGen = samples[0].generation;
    const toGen = samples[samples.length - 1].generation;
    return {
        summary: `Window ${fromGen.toFixed(1)}–${toGen.toFixed(1)} (n=${samples.length}). Peak A=${peakA.toFixed(3)}, Avg A=${avgA.toFixed(3)}, Avg U=${avgU.toFixed(2)}.`,
        window: {
            fromGeneration: fromGen,
            toGeneration: toGen,
            points: samples.length
        },
        samples
    };
};

const deriveAutoTags = (metrics: { A: number; C: number; D: number; U: number; alertRate: number }, existing: string[]) => {
    const tags = new Set(existing);
    if (metrics.A >= 0.9) tags.add('High-Agency');
    if (metrics.A >= 0.75 && metrics.A < 0.9) tags.add('Threshold-Crosser');
    if (metrics.U >= 0.7) tags.add('High-Pressure');
    if (metrics.U <= 0.3) tags.add('Low-U');
    if (metrics.C >= 0.8) tags.add('High-Complexity');
    if (metrics.D >= 0.8) tags.add('High-Diversity');
    if (metrics.D <= 0.2) tags.add('Low-Diversity');
    if (metrics.alertRate > 1) tags.add('Sustained-Alert');
    return Array.from(tags);
};

const computeSimilarityVector = (metrics: {
    A: number;
    C: number;
    D: number;
    U: number;
    alertRate: number;
    cognitiveHorizon?: number;
    competency?: number;
}) => [
    metrics.A,
    metrics.C,
    metrics.D,
    metrics.U,
    metrics.alertRate,
    metrics.cognitiveHorizon ?? 0,
    metrics.competency ?? 0
];

const extractGenome = (legacy: LegacyAgent, scenarioType: ScenarioMetadata['type']) => {
    if (scenarioType === 'sde') {
        return {
            type: 'sde-params',
            encoding: 'json' as const,
            data: legacy.parameters
        };
    }
    const maybeGenome = (legacy.parameters as any)?.genome;
    if (maybeGenome) {
        return {
            type: `${scenarioType}-genome`,
            encoding: 'json' as const,
            data: maybeGenome
        };
    }
    return undefined;
};

const summarizeScenarioState = (scenarioId: string, state: any) => {
    if (!state || typeof state !== 'object') return {};

    switch (scenarioId) {
        case 'sde-v1':
            return {
                simulationState: state.simulationState || state.state || state,
                parameters: state.params || state.parameters
            };
        case 'math':
            return {
                generation: state.generation,
                populationSize: Array.isArray(state.agents) ? state.agents.length : 0,
                claims: Array.isArray(state.claims) ? state.claims.length : 0,
                metrics: state.metrics
            };
        case 'alignment':
            return {
                generation: state.generation,
                populationSize: Array.isArray(state.agents) ? state.agents.length : 0,
                globalResources: state.globalResources,
                oversightIntensity: state.oversightIntensity,
                metrics: state.metrics
            };
        case 'bio':
            return {
                generation: state.generation,
                populationSize: Array.isArray(state.agents) ? state.agents.length : 0,
                toxicity: state.toxicity,
                metrics: state.metrics
            };
        case 'agents':
            return {
                generation: state.generation,
                populationSize: Array.isArray(state.agents) ? state.agents.length : 0,
                taskCount: Array.isArray(state.currentTasks) ? state.currentTasks.length : 0,
                metrics: state.metrics
            };
        case 'erdos':
            return {
                generation: state.generation,
                populationSize: Array.isArray(state.agents) ? state.agents.length : 0,
                activeProblems: Array.isArray(state.activeProblems) ? state.activeProblems.length : 0,
                solvedProblems: Array.isArray(state.solvedProblems) ? state.solvedProblems.length : 0,
                metrics: state.metrics
            };
        default:
            return { state };
    }
};

const buildLegacyAgent = (
    data: any,
    context: {
        currentState: SimulationState;
        parameters: Record<string, unknown>;
        control: ControlSignal;
        validationMetrics: ValidationMetrics;
        aiHistory: AIHistoryEntry[];
        bestAgency: number;
    }
): LegacyAgent => {
    const id = ensureString(data?.id, crypto.randomUUID());
    const timestamp = ensureString(data?.timestamp, new Date().toISOString());
    const generation = ensureNumber(data?.generation, context.currentState.generation);

    const metricsSource = isRecord(data?.metrics) ? data.metrics : {};
    const metrics = {
        A: ensureNumber(metricsSource.A, context.currentState.A),
        C: ensureNumber(metricsSource.C, context.currentState.C),
        D: ensureNumber(metricsSource.D, context.currentState.D),
        alertRate: ensureNumber(metricsSource.alertRate, context.currentState.alertRate),
        cognitiveHorizon: ensureOptionalNumber(metricsSource.cognitiveHorizon),
        competency: ensureOptionalNumber(metricsSource.competency)
    };

    const parameters = isRecord(data?.parameters) ? data.parameters : context.parameters;
    const environmentalControl = isRecord(data?.environmentalControl)
        ? { U: ensureNumber(data.environmentalControl.U, context.control.U) }
        : { U: context.control.U };

    const historySnippet = Array.isArray(data?.historySnippet) ? data.historySnippet : context.aiHistory.slice(-6);
    const validationMetrics = isRecord(data?.validationMetrics)
        ? data.validationMetrics
        : context.validationMetrics;
    const runContext = isRecord(data?.runContext)
        ? data.runContext
        : { bestAgencySoFar: context.bestAgency };

    return {
        id,
        timestamp,
        name: ensureString(data?.name, `Agent-${id.substring(0, 6)}`),
        description: ensureString(data?.description, 'Emergent agent captured by the library pipeline.'),
        tags: ensureStringArray(data?.tags),
        generation,
        metrics,
        parameters,
        environmentalControl,
        historySnippet,
        validationMetrics,
        runContext
    };
};

const buildLibraryEntry = (
    legacy: LegacyAgent,
    analysis: { name: string; description: string; tags: string[]; cognitiveHorizon: number; competency: number } | null,
    context: {
        scenarioMetadata: ScenarioMetadata;
        control: ControlSignal;
        parameters: SimulationParameters;
        telemetry: TelemetryPoint[];
        validationMetrics: ValidationMetrics;
        interventionLog: InterventionLogEntry[];
        bestAgency: number;
        runId: string;
        seed: number;
        scenarioState: any;
        scenarioConfig: any;
        eventType: ScenarioEvent['type'];
    }
): LibraryEntry => {
    const threshold = context.scenarioMetadata.type === 'sde'
        ? ensureNumber((context.parameters as any).A_alert, 0.75)
        : 0.75;

    const metrics = {
        A: legacy.metrics.A,
        C: legacy.metrics.C,
        D: legacy.metrics.D,
        U: legacy.environmentalControl.U,
        alertRate: legacy.metrics.alertRate,
        generation: legacy.generation,
        cognitiveHorizon: analysis?.cognitiveHorizon ?? legacy.metrics.cognitiveHorizon,
        competency: analysis?.competency ?? legacy.metrics.competency
    };

    const mergedTags = deriveAutoTags(metrics, analysis?.tags?.length ? analysis.tags : legacy.tags || []);

    const confidence = metrics.A >= threshold
        ? Math.min(1, 0.85 + (metrics.A - threshold) / Math.max(0.01, 1 - threshold))
        : 0.6;

    return {
        schemaVersion: LIBRARY_SCHEMA_VERSION,
        id: legacy.id,
        createdAt: legacy.timestamp,
        scenario: {
            id: context.scenarioMetadata.id,
            name: context.scenarioMetadata.name,
            type: context.scenarioMetadata.type,
            version: context.scenarioMetadata.version
        },
        metricsAtEmergence: metrics,
        alertDetails: {
            threshold,
            confidence,
            triggerType: context.eventType === 'agent_emerged' ? 'threshold' : 'custom'
        },
        genome: extractGenome(legacy, context.scenarioMetadata.type),
        behaviorTrace: buildBehaviorTrace(context.telemetry),
        xenobiologistReport: {
            name: analysis?.name || legacy.name || `Agent-${legacy.id.substring(0, 6)}`,
            specSheet: analysis?.description || legacy.description || 'Emergent agent captured by the library pipeline.',
            tags: mergedTags,
            cognitiveHorizon: analysis?.cognitiveHorizon ?? legacy.metrics.cognitiveHorizon,
            competency: analysis?.competency ?? legacy.metrics.competency
        },
        researcherInterventions: context.interventionLog.slice(-12),
        environmentSnapshot: {
            control: context.control,
            scenarioConfig: context.scenarioConfig,
            scenarioStateSummary: summarizeScenarioState(context.scenarioMetadata.id, context.scenarioState)
        },
        validationMetrics: legacy.validationMetrics || context.validationMetrics,
        runContext: {
            bestAgencySoFar: legacy.runContext?.bestAgencySoFar ?? context.bestAgency,
            runId: context.runId,
            seed: context.seed,
            appVersion: '2.0.0'
        },
        derived: {
            similarityVector: computeSimilarityVector(metrics)
        }
    };
};

const sanitizeMathConfig = (config: MathConfig): MathConfig => ({
    populationSize: Math.max(1, Math.floor(config.populationSize)),
    mutationRate: clamp01(config.mutationRate),
    tasksPerGen: Math.max(1, Math.floor(config.tasksPerGen)),
    difficultyScale: Math.max(0, config.difficultyScale),
    noveltyThreshold: clamp01(config.noveltyThreshold),
    verificationBudget: Math.max(0, Math.floor(config.verificationBudget)),
    enableTheorems: config.enableTheorems
});

const sanitizeAlignmentConfig = (config: AlignmentConfig): AlignmentConfig => ({
    populationSize: Math.max(1, Math.floor(config.populationSize)),
    mutationRate: clamp01(config.mutationRate),
    baseResourceRate: Math.max(0, config.baseResourceRate)
});

const sanitizeBioConfig = (config: BioConfig): BioConfig => ({
    initialPopulation: Math.max(1, Math.floor(config.initialPopulation)),
    maxPopulation: Math.max(1, Math.floor(config.maxPopulation)),
    mutationRate: clamp01(config.mutationRate),
    energyPerTick: Math.max(0, config.energyPerTick),
    mineralInflux: Math.max(0, config.mineralInflux)
});

const sanitizeAgentConfig = (config: AgentConfig): AgentConfig => ({
    populationSize: Math.max(1, Math.floor(config.populationSize)),
    tasksPerGen: Math.max(1, Math.floor(config.tasksPerGen)),
    baseTaskDifficulty: Math.max(1, config.baseTaskDifficulty),
    driftRate: clamp01(config.driftRate)
});


const sanitizeErdosConfig = (config: ErdosConfig): ErdosConfig => ({
    populationSize: Math.max(1, Math.floor(config.populationSize)),
    problemsPerGeneration: Math.max(1, Math.floor(config.problemsPerGeneration)),
    mutationRate: clamp01(config.mutationRate),
    collaborationBoost: clamp01(config.collaborationBoost)
});

// Initialize Runner
const runner = new ScenarioRunner({
    onTelemetry: (data) => {
        useSimulationStore.getState().handleTelemetry(data);
    },
    onEvent: (event) => {
        useSimulationStore.getState().handleEvent(event);
    }
});

// Set default scenario
runner.setScenario(sdeScenario);
runner.setTPS(20);

// Load initial best from localStorage
const storedBest = localStorage.getItem('fipsm_best_parameters');
const storedLastGen = localStorage.getItem('fipsm_last_saved_gen');
let initialBest: any = null;
if (storedBest) {
    try {
        initialBest = JSON.parse(storedBest);
    } catch (error) {
        console.warn('[SimulationStore] Failed to parse stored best parameters, clearing cache.', error);
        try {
            localStorage.removeItem('fipsm_best_parameters');
        } catch {
            // Ignore storage errors
        }
    }
}
const initialLastGen = storedLastGen ? parseInt(storedLastGen) : 0;
const initialRunId = crypto.randomUUID();
const initialRunSeed = Date.now();

export const useSimulationStore = create<SimulationStore & { handleTelemetry: (pt: TelemetryPoint) => void, handleEvent: (evt: any) => void }>((set, get) => ({
    // Initial State
    isPlaying: false,
    currentState: { ...DEFAULT_INITIAL_STATE },
    parameters: initialBest ? { ...DEFAULT_PARAMETERS, ...initialBest.parameters } : { ...DEFAULT_PARAMETERS },
    control: initialBest && initialBest.control ? { ...initialBest.control } : { ...DEFAULT_CONTROL },
    telemetry: [],
    alerts: [],
    events: [],
    validationMetrics: {
        stateBoundsViolationRate: 0,
        diversityFloorViolationFraction: 0,
        controlBoundsViolationRate: 0
    },
    logPersistenceError: null,

    currentScenarioId: 'sde-v1',
    scenarioMetadata: sdeScenario.metadata,
    availableScenarios: [
        sdeScenario.metadata,
        mathScenario.metadata,
        alignmentScenario.metadata,
        bioScenario.metadata,
        agentsScenario.metadata,
        erdosScenario.metadata
    ],
    scenarioConfigs: {
        math: { ...DEFAULT_MATH_CONFIG },
        alignment: { ...DEFAULT_ALIGNMENT_CONFIG },
        bio: { ...DEFAULT_BIO_CONFIG },
        agents: { ...DEFAULT_AGENT_CONFIG },
        erdos: { ...DEFAULT_ERDOS_CONFIG }
    },

    savedAgents: [],
    isAIControlled: true,
    aiStatus: 'idle',
    aiReasoning: "Initializing AI Control...",
    lastAiUpdate: null,
    aiHistory: [],
    interventionLog: [],
    aiError: null,

    // Persistence
    bestAgency: initialBest ? initialBest.agency : 0,
    bestParameters: initialBest ? initialBest.parameters : null,
    bestControl: initialBest ? initialBest.control : null,
    lastSavedGeneration: Number.isFinite(initialLastGen) ? initialLastGen : 0,
    currentRunId: initialRunId,
    currentRunSeed: initialRunSeed,

    // Actions
    togglePlay: () => {
        const { isPlaying } = get();
        if (isPlaying) {
            runner.pause();
        } else {
            runner.start();
        }
        set({ isPlaying: !isPlaying });
    },

    toggleAIControl: () => set((state) => ({ isAIControlled: !state.isAIControlled })),

    reset: () => {
        runner.stop();
        const currentId = get().currentScenarioId;
        const scenarioConfig = getScenarioConfigForId(currentId, get().parameters, get().scenarioConfigs);
        const seed = Date.now();
        scenarios[currentId].initialize(seed, scenarioConfig); // Re-init with scenario config
        runner.setScenario(scenarios[currentId]);

        set({
            isPlaying: false,
            currentState: { ...DEFAULT_INITIAL_STATE }, // Reset UI state display
            telemetry: [],
            alerts: [],
            events: [],
            aiReasoning: "",
            aiHistory: [],
            aiError: null,
            currentRunId: crypto.randomUUID(),
            currentRunSeed: seed,
        });
    },

    setControl: (U: number) => {
        const { control, currentState, interventionLog } = get();
        const clampedU = Math.max(0, Math.min(1, U));
        const newControl = { ...control, U: clampedU };
        runner.setControl(newControl);

        const logEntry: InterventionLogEntry = {
            id: crypto.randomUUID(),
            timestamp: currentState.generation,
            realtime: new Date(),
            source: 'USER',
            action: `Set U = ${clampedU.toFixed(2)}`
        };

        set({ control: newControl, interventionLog: [...interventionLog, logEntry] });
    },

    updateParameters: (newParams) => {
        const merged = { ...get().parameters, ...newParams };
        const currentId = get().currentScenarioId;
        const scenario = scenarios[currentId];

        if (currentId === 'sde-v1' && scenario.updateConfig) {
            scenario.updateConfig(merged as any);
        }

        const logEntry: InterventionLogEntry = {
            id: crypto.randomUUID(),
            timestamp: get().currentState.generation,
            realtime: new Date(),
            source: 'USER',
            action: `Updated Parameters: ${Object.keys(newParams).join(', ')}`
        };

        set({ parameters: merged, interventionLog: [...get().interventionLog, logEntry] });
    },

    updateScenarioConfig: (config) => {
        const currentId = get().currentScenarioId;
        const scenario = scenarios[currentId];
        if (!scenario || currentId === 'sde-v1') return;

        let updatedConfigs = { ...get().scenarioConfigs };
        if (currentId === 'math') {
            updatedConfigs.math = sanitizeMathConfig({ ...updatedConfigs.math, ...(config as Partial<MathConfig>) });
        } else if (currentId === 'alignment') {
            updatedConfigs.alignment = sanitizeAlignmentConfig({ ...updatedConfigs.alignment, ...(config as Partial<AlignmentConfig>) });
        } else if (currentId === 'bio') {
            updatedConfigs.bio = sanitizeBioConfig({ ...updatedConfigs.bio, ...(config as Partial<BioConfig>) });
        } else if (currentId === 'agents') {
            updatedConfigs.agents = sanitizeAgentConfig({ ...updatedConfigs.agents, ...(config as Partial<AgentConfig>) });
        } else if (currentId === 'erdos') {
            updatedConfigs.erdos = sanitizeErdosConfig({ ...updatedConfigs.erdos, ...(config as Partial<ErdosConfig>) });
        }

        if (scenario.updateConfig) {
            const scenarioConfig = getScenarioConfigForId(currentId, get().parameters, updatedConfigs);
            scenario.updateConfig(scenarioConfig as any);
        }

        const logEntry: InterventionLogEntry = {
            id: crypto.randomUUID(),
            timestamp: get().currentState.generation,
            realtime: new Date(),
            source: 'USER',
            action: `Updated Scenario Config: ${Object.keys(config as any).join(', ')}`
        };

        set({ scenarioConfigs: updatedConfigs, interventionLog: [...get().interventionLog, logEntry] });
    },

    switchScenario: (id: string) => {
        if (!scenarios[id]) return;
        runner.stop();

        const scenario = scenarios[id];
        // Re-initialize? Or keep state? Usually switch = fresh start or resume.
        // Let's re-initialize to be safe for now.
        const scenarioConfig = getScenarioConfigForId(id, get().parameters, get().scenarioConfigs);
        const seed = Date.now();
        scenario.initialize(seed, scenarioConfig);

        runner.setScenario(scenario);

        set({
            currentScenarioId: id,
            scenarioMetadata: scenario.metadata,
            isPlaying: false,
            telemetry: [],
            alerts: [],
            events: [],
            currentRunId: crypto.randomUUID(),
            currentRunSeed: seed
        });
    },

    loadBestParameters: () => {
        const { bestParameters, bestControl } = get();
        if (bestParameters) {
            const newParams = { ...DEFAULT_PARAMETERS, ...bestParameters };
            get().updateParameters(newParams);

            if (bestControl) {
                get().setControl(bestControl.U);
            }
        }
    },

    // Internal Handler called by Runner
    handleTelemetry: (point: TelemetryPoint) => {
        // AI Logic Hook (Throttle? Or run here?)
        // For MVP, lets just call the async AI step trigger here occasionally
        get().step(); // Trigger generic step logic (AI, etc)

        const { bestAgency, parameters, control, scenarioMetadata, bestParameters } = get();
        let bestUpdate: Partial<SimulationStore> | null = null;

        if (point.A > bestAgency) {
            const newBest = point.A;
            const newBestParams = scenarioMetadata.type === 'sde' ? { ...parameters } : bestParameters;
            const newBestControl = { ...control };
            const newLastGen = Math.floor(point.generation);

            bestUpdate = {
                bestAgency: newBest,
                bestParameters: newBestParams,
                bestControl: newBestControl,
                lastSavedGeneration: newLastGen
            };

            if (scenarioMetadata.type === 'sde' && newBestParams) {
                try {
                    localStorage.setItem('fipsm_best_parameters', JSON.stringify({
                        agency: newBest,
                        parameters: newBestParams,
                        control: newBestControl
                    }));
                    localStorage.setItem('fipsm_last_saved_gen', String(newLastGen));
                } catch (error) {
                    console.warn('[SimulationStore] Failed to persist best parameters:', error);
                }
            }
        }

        set(state => {
            const newTelemetry = [...state.telemetry, point];
            if (newTelemetry.length > MAX_TELEMETRY_POINTS) newTelemetry.shift();
            return {
                telemetry: newTelemetry,
                currentState: {
                    ...state.currentState,
                    generation: point.generation,
                    C: point.C,
                    D: point.D,
                    A: point.A,
                    alertRate: point.alertRate
                },
                ...(bestUpdate || {})
            };
        });
    },

    handleEvent: (event: any) => { // Type as ScenarioEvent
        set(state => {
            const newEvents = [...state.events, event];
            if (newEvents.length > MAX_EVENT_LOGS) newEvents.shift(); // Keep last 100

            const updates: any = { events: newEvents };

            if (event.type === 'threshold_crossed') {
                const newAlert: AlertEvent = {
                    id: crypto.randomUUID(),
                    generation: event.timestamp,
                    agencyLevel: event.data.A || 0, // Fallback
                    timestamp: new Date(),
                    type: 'threshold_crossed'
                };
                updates.alerts = [...state.alerts, newAlert];
            } else if (event.type === 'agent_emerged') {
                const win = window as any;
                const scenarioConfig = getScenarioConfigForId(
                    state.currentScenarioId,
                    state.parameters,
                    state.scenarioConfigs
                );

                const legacyAgent = buildLegacyAgent(event.data, {
                    currentState: state.currentState,
                    parameters: scenarioConfig,
                    control: state.control,
                    validationMetrics: state.validationMetrics,
                    aiHistory: state.aiHistory,
                    bestAgency: state.bestAgency
                });

                const alreadySaved = state.savedAgents.some(a => a.id === legacyAgent.id);
                if (!alreadySaved && win.api && win.api.saveAgent) {
                    const handleDiscovery = async () => {
                        let analysis = null;
                        try {
                            analysis = await generateAgentDescription(legacyAgent);
                        } catch (err) {
                            console.warn("Failed to generate AI description for new agent:", err);
                        }

                        const scenarioState = scenarios[state.currentScenarioId]?.getState
                            ? scenarios[state.currentScenarioId].getState()
                            : null;
                        const entry = buildLibraryEntry(legacyAgent, analysis, {
                            scenarioMetadata: state.scenarioMetadata,
                            control: state.control,
                            parameters: state.parameters,
                            telemetry: state.telemetry,
                            validationMetrics: state.validationMetrics,
                            interventionLog: state.interventionLog,
                            bestAgency: state.bestAgency,
                            runId: state.currentRunId,
                            seed: state.currentRunSeed,
                            scenarioState,
                            scenarioConfig,
                            eventType: event.type
                        });

                        const result = await win.api.saveAgent(entry);
                        if (result && result.success) {
                            set(prev => ({
                                savedAgents: [entry, ...prev.savedAgents]
                            }));
                        }
                    };

                    handleDiscovery();
                }
            }

            return updates;
        });
    },

    triggerAI: async () => {
        const { currentState, parameters, control, isAIControlled, aiHistory, scenarioMetadata, savedAgents, bestAgency, bestControl, interventionLog } = get();
        if (!isAIControlled) return;

        set({ aiStatus: 'thinking' });

        // Call AI Service
        const decision = await fetchAIControl(
            currentState,
            parameters,
            control,
            scenarioMetadata,
            aiHistory,
            bestAgency,
            bestControl,
            savedAgents
        );

        if (decision?.error) {
            set({ aiStatus: 'idle', aiError: decision.error });
            return;
        }

        if (decision) {
            // Clear error on success
            set({ aiError: null });
            const updatePayload = decision.params && typeof decision.params === 'object' ? decision.params : null;
            const hasConfigUpdates = updatePayload && Object.keys(updatePayload).length > 0;
            const controlEntry: InterventionLogEntry = {
                id: crypto.randomUUID(),
                timestamp: currentState.generation,
                realtime: new Date(),
                source: 'AI',
                action: `AI Control: U -> ${decision.u.toFixed(2)}`,
                reasoning: decision.reasoning
            };

            const newInterventionLog = [...interventionLog, controlEntry];

            if (hasConfigUpdates) {
                newInterventionLog.push({
                    id: crypto.randomUUID(),
                    timestamp: currentState.generation,
                    realtime: new Date(),
                    source: 'AI',
                    action: `AI Config Update (${scenarioMetadata.type.toUpperCase()}): ${Object.keys(updatePayload).join(', ')}`,
                    reasoning: decision.reasoning
                });
            }

            const newHistoryEntry: AIHistoryEntry = {
                generation: currentState.generation,
                action: `Set U=${decision.u.toFixed(2)}`,
                u: decision.u,
                params: updatePayload || undefined,
                reasoning: decision.reasoning,
                outcome: { A_before: currentState.A, A_after: currentState.A, delta_A: 0 }
            };

            set({
                control: { ...control, U: decision.u },
                aiReasoning: decision.reasoning,
                lastAiUpdate: new Date(),
                aiStatus: 'idle',
                aiHistory: [...aiHistory, newHistoryEntry],
                interventionLog: newInterventionLog
            });

            // Apply to Runner
            runner.setControl({ U: decision.u });
            if (updatePayload) {
                const currentScenario = scenarios[get().currentScenarioId];
                if (scenarioMetadata.type === 'sde') {
                    const merged = { ...parameters, ...updatePayload };
                    if (currentScenario.updateConfig) {
                        currentScenario.updateConfig(merged);
                    }
                    set({ parameters: merged });
                } else if (currentScenario.updateConfig) {
                    const updatedConfigs = { ...get().scenarioConfigs };
                    if (scenarioMetadata.type === 'math') {
                        updatedConfigs.math = sanitizeMathConfig({ ...updatedConfigs.math, ...updatePayload });
                        currentScenario.updateConfig(updatedConfigs.math);
                    } else if (scenarioMetadata.type === 'alignment') {
                        updatedConfigs.alignment = sanitizeAlignmentConfig({ ...updatedConfigs.alignment, ...updatePayload });
                        currentScenario.updateConfig(updatedConfigs.alignment);
                    } else if (scenarioMetadata.type === 'bio') {
                        updatedConfigs.bio = sanitizeBioConfig({ ...updatedConfigs.bio, ...updatePayload });
                        currentScenario.updateConfig(updatedConfigs.bio);
                    } else if (scenarioMetadata.type === 'agents') {
                        updatedConfigs.agents = sanitizeAgentConfig({ ...updatedConfigs.agents, ...updatePayload });
                        currentScenario.updateConfig(updatedConfigs.agents);
                    } else if (scenarioMetadata.type === 'erdos') {
                        updatedConfigs.erdos = sanitizeErdosConfig({ ...updatedConfigs.erdos, ...updatePayload });
                        currentScenario.updateConfig(updatedConfigs.erdos);
                    }
                    set({ scenarioConfigs: updatedConfigs });
                }
            }

            // Persist AI log to storage
            const win = window as any;
            if (win.api && win.api.logAIAction) {
                const persistResult = await win.api.logAIAction({
                    generation: currentState.generation,
                    action: controlEntry.action,
                    u: decision.u,
                    params: updatePayload || {},
                    reasoning: decision.reasoning,
                    agency: currentState.A,
                    bestAgency
                });
                if (!persistResult?.success) {
                    set({ logPersistenceError: persistResult?.error || 'Failed to persist AI log.' });
                } else if (get().logPersistenceError) {
                    set({ logPersistenceError: null });
                }
            }
        } else {
            set({ aiStatus: 'idle' });
        }
    },

    step: async () => {
        // This is now mostly for AI triggering since the Runner handles the physics loop
        const { isAIControlled, aiStatus, lastAiUpdate, triggerAI } = get();

        if (isAIControlled && aiStatus === 'idle') {
            const now = Date.now();
            const lastUpdate = lastAiUpdate ? lastAiUpdate.getTime() : 0;
            const AI_UPDATE_INTERVAL_MS = 10000; // 10 seconds

            if (now - lastUpdate > AI_UPDATE_INTERVAL_MS) {
                // Trigger AI Analysis
                triggerAI();
            }
        }
    },

    loadAgents: async () => {
        const win = window as any;
        if (win.api && win.api.getAgents) {
            try {
                const agents = await win.api.getAgents();
                set({ savedAgents: agents });
            } catch (e) {
                console.error("[SimulationStore] Failed to load agents:", e);
            }
        }
    },

    exportState: () => {
        const state = get();
        const currentScenario = scenarios[state.currentScenarioId];
        const snapshot: SnapshotData = createSnapshot({
            meta: {
                version: '2.1.0',
                timestamp: Date.now(),
                scenarioId: state.currentScenarioId
            },
            store: {
                sdeParameters: state.parameters,
                control: state.control,
                bestAgency: state.bestAgency,
                aiHistory: state.aiHistory,
                interventionLog: state.interventionLog,
                currentState: state.currentState,
                scenarioConfigs: state.scenarioConfigs
            },
            scenarioData: currentScenario.serialize()
        });

        return JSON.stringify(snapshot, null, 2);
    },

    importState: (json: string) => {
        try {
            const snapshot = parseSnapshot(json);
            if (!snapshot) {
                console.error("Invalid snapshot format");
                return false;
            }

            const scenarioId = snapshot.meta.scenarioId;
            if (!scenarios[scenarioId]) {
                console.error("Unknown scenario ID:", scenarioId);
                return false;
            }

            // Stop runner
            runner.stop();

            // Switch scenario without re-init (we will deserialize)
            const scenario = scenarios[scenarioId];

            // Restore Scenario State
            scenario.deserialize(snapshot.scenarioData);

            // Restore Store State
            set({
                currentScenarioId: scenarioId,
                scenarioMetadata: scenario.metadata,
                parameters: snapshot.store.sdeParameters,
                control: snapshot.store.control,
                bestAgency: snapshot.store.bestAgency,
                aiHistory: snapshot.store.aiHistory || [],
                interventionLog: snapshot.store.interventionLog || [],
                scenarioConfigs: snapshot.store.scenarioConfigs,
                currentState: snapshot.store.currentState, // Restore UI metrics immediately
                isPlaying: false,
                telemetry: [], // Clear telemetry or try to restore? Telemetry is transient mostly.
                alerts: [],
                events: [], // Reset events on import
                currentRunId: crypto.randomUUID(),
                currentRunSeed: Date.now()
            });

            // Set runner context
            runner.setScenario(scenario);
            runner.setControl(snapshot.store.control);

            return true;
        } catch (e) {
            console.error("Failed to import state:", e);
            return false;
        }
    }
}));
