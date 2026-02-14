import {
    AIHistoryEntry,
    ControlSignal,
    DEFAULT_CONTROL,
    DEFAULT_INITIAL_STATE,
    DEFAULT_PARAMETERS,
    InterventionLogEntry,
    SimulationParameters,
    SimulationState
} from './types';
import { DEFAULT_MATH_CONFIG, MathConfig } from './scenarios/math/MathTypes';
import { DEFAULT_ALIGNMENT_CONFIG, AlignmentConfig } from './scenarios/alignment/AlignmentTypes';
import { DEFAULT_BIO_CONFIG, BioConfig } from './scenarios/bio/BioTypes';
import { DEFAULT_AGENT_CONFIG, AgentConfig } from './scenarios/agents/AgentTypes';
import { DEFAULT_ERDOS_CONFIG, ErdosConfig } from './scenarios/erdos/ErdosTypes';

export const SNAPSHOT_VERSION = '2.1.0';

export interface SnapshotStore {
    sdeParameters: SimulationParameters;
    control: ControlSignal;
    bestAgency: number;
    aiHistory: AIHistoryEntry[];
    interventionLog: InterventionLogEntry[];
    currentState: SimulationState;
    scenarioConfigs: {
        math: MathConfig;
        alignment: AlignmentConfig;
        bio: BioConfig;
        agents: AgentConfig;
        erdos: ErdosConfig;
    };
}

export interface SnapshotMeta {
    version: string;
    timestamp: number;
    scenarioId: string;
}

export interface SnapshotData {
    meta: SnapshotMeta;
    store: SnapshotStore;
    scenarioData: string;
}

const KNOWN_SCENARIOS = new Set(['sde-v1', 'math', 'alignment', 'bio', 'agents', 'erdos']);

export const normalizeScenarioId = (value: unknown): string => {
    if (typeof value === 'string' && KNOWN_SCENARIOS.has(value)) {
        return value;
    }
    return 'sde-v1';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const sanitizeParameters = (value: unknown): SimulationParameters => {
    if (!isRecord(value)) return { ...DEFAULT_PARAMETERS };
    const next = { ...DEFAULT_PARAMETERS };
    (Object.keys(next) as (keyof SimulationParameters)[]).forEach(key => {
        const candidate = value[key];
        if (isFiniteNumber(candidate)) {
            next[key] = candidate as any;
        }
    });
    return next;
};

const sanitizeControl = (value: unknown): ControlSignal => {
    if (!isRecord(value)) return { ...DEFAULT_CONTROL };
    const u = isFiniteNumber(value.U) ? clamp01(value.U) : DEFAULT_CONTROL.U;
    return { U: u };
};

const sanitizeState = (value: unknown): SimulationState => {
    if (!isRecord(value)) return { ...DEFAULT_INITIAL_STATE };
    return {
        C: isFiniteNumber(value.C) ? clamp01(value.C) : DEFAULT_INITIAL_STATE.C,
        D: isFiniteNumber(value.D) ? clamp01(value.D) : DEFAULT_INITIAL_STATE.D,
        A: isFiniteNumber(value.A) ? clamp01(value.A) : DEFAULT_INITIAL_STATE.A,
        alertRate: isFiniteNumber(value.alertRate) ? Math.max(0, value.alertRate) : DEFAULT_INITIAL_STATE.alertRate,
        generation: isFiniteNumber(value.generation) ? value.generation : DEFAULT_INITIAL_STATE.generation
    };
};

const sanitizeMathConfig = (value: unknown): MathConfig => {
    if (!isRecord(value)) return { ...DEFAULT_MATH_CONFIG };
    return {
        populationSize: isFiniteNumber(value.populationSize) ? Math.max(1, Math.floor(value.populationSize)) : DEFAULT_MATH_CONFIG.populationSize,
        mutationRate: isFiniteNumber(value.mutationRate) ? clamp01(value.mutationRate) : DEFAULT_MATH_CONFIG.mutationRate,
        tasksPerGen: isFiniteNumber(value.tasksPerGen) ? Math.max(1, Math.floor(value.tasksPerGen)) : DEFAULT_MATH_CONFIG.tasksPerGen,
        difficultyScale: isFiniteNumber(value.difficultyScale) ? Math.max(0, value.difficultyScale) : DEFAULT_MATH_CONFIG.difficultyScale,
        noveltyThreshold: isFiniteNumber(value.noveltyThreshold) ? clamp01(value.noveltyThreshold) : DEFAULT_MATH_CONFIG.noveltyThreshold,
        verificationBudget: isFiniteNumber(value.verificationBudget) ? Math.max(0, Math.floor(value.verificationBudget)) : DEFAULT_MATH_CONFIG.verificationBudget,
        enableTheorems: typeof value.enableTheorems === 'boolean' ? value.enableTheorems : DEFAULT_MATH_CONFIG.enableTheorems
    };
};

const sanitizeAlignmentConfig = (value: unknown): AlignmentConfig => {
    if (!isRecord(value)) return { ...DEFAULT_ALIGNMENT_CONFIG };
    return {
        populationSize: isFiniteNumber(value.populationSize) ? Math.max(1, Math.floor(value.populationSize)) : DEFAULT_ALIGNMENT_CONFIG.populationSize,
        mutationRate: isFiniteNumber(value.mutationRate) ? clamp01(value.mutationRate) : DEFAULT_ALIGNMENT_CONFIG.mutationRate,
        baseResourceRate: isFiniteNumber(value.baseResourceRate) ? Math.max(0, value.baseResourceRate) : DEFAULT_ALIGNMENT_CONFIG.baseResourceRate
    };
};

const sanitizeBioConfig = (value: unknown): BioConfig => {
    if (!isRecord(value)) return { ...DEFAULT_BIO_CONFIG };
    return {
        initialPopulation: isFiniteNumber(value.initialPopulation) ? Math.max(1, Math.floor(value.initialPopulation)) : DEFAULT_BIO_CONFIG.initialPopulation,
        maxPopulation: isFiniteNumber(value.maxPopulation) ? Math.max(1, Math.floor(value.maxPopulation)) : DEFAULT_BIO_CONFIG.maxPopulation,
        mutationRate: isFiniteNumber(value.mutationRate) ? clamp01(value.mutationRate) : DEFAULT_BIO_CONFIG.mutationRate,
        energyPerTick: isFiniteNumber(value.energyPerTick) ? Math.max(0, value.energyPerTick) : DEFAULT_BIO_CONFIG.energyPerTick,
        mineralInflux: isFiniteNumber(value.mineralInflux) ? Math.max(0, value.mineralInflux) : DEFAULT_BIO_CONFIG.mineralInflux
    };
};

const sanitizeAgentConfig = (value: unknown): AgentConfig => {
    if (!isRecord(value)) return { ...DEFAULT_AGENT_CONFIG };
    return {
        populationSize: isFiniteNumber(value.populationSize) ? Math.max(1, Math.floor(value.populationSize)) : DEFAULT_AGENT_CONFIG.populationSize,
        tasksPerGen: isFiniteNumber(value.tasksPerGen) ? Math.max(1, Math.floor(value.tasksPerGen)) : DEFAULT_AGENT_CONFIG.tasksPerGen,
        baseTaskDifficulty: isFiniteNumber(value.baseTaskDifficulty) ? Math.max(1, value.baseTaskDifficulty) : DEFAULT_AGENT_CONFIG.baseTaskDifficulty,
        driftRate: isFiniteNumber(value.driftRate) ? clamp01(value.driftRate) : DEFAULT_AGENT_CONFIG.driftRate
    };
};


const sanitizeErdosConfig = (value: unknown): ErdosConfig => {
    if (!isRecord(value)) return { ...DEFAULT_ERDOS_CONFIG };
    return {
        populationSize: isFiniteNumber(value.populationSize) ? Math.max(1, Math.floor(value.populationSize)) : DEFAULT_ERDOS_CONFIG.populationSize,
        problemsPerGeneration: 1,
        mutationRate: isFiniteNumber(value.mutationRate) ? clamp01(value.mutationRate) : DEFAULT_ERDOS_CONFIG.mutationRate,
        collaborationBoost: isFiniteNumber(value.collaborationBoost) ? clamp01(value.collaborationBoost) : DEFAULT_ERDOS_CONFIG.collaborationBoost
    };
};

const sanitizeScenarioConfigs = (value: unknown): SnapshotStore['scenarioConfigs'] => {
    if (!isRecord(value)) {
        return {
            math: { ...DEFAULT_MATH_CONFIG },
            alignment: { ...DEFAULT_ALIGNMENT_CONFIG },
            bio: { ...DEFAULT_BIO_CONFIG },
            agents: { ...DEFAULT_AGENT_CONFIG },
            erdos: { ...DEFAULT_ERDOS_CONFIG }
        };
    }
    return {
        math: sanitizeMathConfig(value.math),
        alignment: sanitizeAlignmentConfig(value.alignment),
        bio: sanitizeBioConfig(value.bio),
        agents: sanitizeAgentConfig(value.agents),
        erdos: sanitizeErdosConfig(value.erdos)
    };
};

export const createSnapshot = (data: SnapshotData): SnapshotData => {
    return {
        meta: {
            version: SNAPSHOT_VERSION,
            timestamp: data.meta.timestamp,
            scenarioId: data.meta.scenarioId
        },
        store: data.store,
        scenarioData: data.scenarioData
    };
};

const migrateV2_0 = (raw: any): SnapshotData | null => {
    if (!isRecord(raw?.meta) || !isRecord(raw?.store)) return null;
    const scenarioId = normalizeScenarioId(raw.meta.scenarioId);
    const store = raw.store as Record<string, unknown>;
    const storeData: SnapshotStore = {
        sdeParameters: sanitizeParameters(store.parameters),
        control: sanitizeControl(store.control),
        bestAgency: isFiniteNumber(store.bestAgency) ? store.bestAgency : 0,
        aiHistory: Array.isArray(store.aiHistory) ? store.aiHistory as AIHistoryEntry[] : [],
        interventionLog: Array.isArray(store.interventionLog) ? store.interventionLog as InterventionLogEntry[] : [],
        currentState: sanitizeState(store.currentState),
        scenarioConfigs: sanitizeScenarioConfigs(store.scenarioConfigs)
    };
    if (typeof raw.scenarioData !== 'string') {
        return null;
    }
    return {
        meta: {
            version: SNAPSHOT_VERSION,
            timestamp: isFiniteNumber(raw.meta.timestamp) ? raw.meta.timestamp : Date.now(),
            scenarioId
        },
        store: storeData,
        scenarioData: raw.scenarioData
    };
};

export const parseSnapshot = (json: string): SnapshotData | null => {
    try {
        const raw = JSON.parse(json);
        if (!isRecord(raw)) return null;

        const version = typeof raw.meta?.version === 'string' ? raw.meta.version : '2.0.0';
        if (version === SNAPSHOT_VERSION) {
            if (!isRecord(raw.meta) || !isRecord(raw.store)) return null;
            const scenarioId = normalizeScenarioId(raw.meta.scenarioId);
            if (typeof raw.scenarioData !== 'string') return null;
            return {
                meta: {
                    version,
                    timestamp: isFiniteNumber(raw.meta.timestamp) ? raw.meta.timestamp : Date.now(),
                    scenarioId
                },
                store: {
                    sdeParameters: sanitizeParameters(raw.store.sdeParameters),
                    control: sanitizeControl(raw.store.control),
                    bestAgency: isFiniteNumber(raw.store.bestAgency) ? raw.store.bestAgency : 0,
                    aiHistory: Array.isArray(raw.store.aiHistory) ? raw.store.aiHistory as AIHistoryEntry[] : [],
                    interventionLog: Array.isArray(raw.store.interventionLog) ? raw.store.interventionLog as InterventionLogEntry[] : [],
                    currentState: sanitizeState(raw.store.currentState),
                    scenarioConfigs: sanitizeScenarioConfigs(raw.store.scenarioConfigs)
                },
                scenarioData: raw.scenarioData
            };
        }

        if (version === '2.0.0') {
            return migrateV2_0(raw);
        }

        return null;
    } catch {
        return null;
    }
};
