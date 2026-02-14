import { ScenarioType } from './scenarioTypes';

export const LIBRARY_SCHEMA_VERSION = '2.1.0' as const;

export type AlertTriggerType = 'peak' | 'threshold' | 'sustained' | 'custom';

export interface EmergenceMetrics {
    A: number;
    C: number;
    D: number;
    U: number;
    alertRate: number;
    generation: number;
    cognitiveHorizon?: number;
    competency?: number;
}

export interface XenobiologistReport {
    name: string;
    specSheet: string;
    tags: string[];
    narrative?: string;
    cognitiveHorizon?: number;
    competency?: number;
}

export interface BehaviorTrace {
    summary: string;
    window?: {
        fromGeneration: number;
        toGeneration: number;
        points: number;
    };
    samples?: Array<{
        generation: number;
        C: number;
        D: number;
        A: number;
        U: number;
        alertRate: number;
    }>;
    uri?: string;
}

export interface LibraryEntry {
    schemaVersion: typeof LIBRARY_SCHEMA_VERSION;

    id: string;
    createdAt: string; // ISO

    scenario: {
        id: string;
        name: string;
        type: ScenarioType;
        version: string;
    };

    metricsAtEmergence: EmergenceMetrics;

    alertDetails: {
        threshold: number;
        confidence: number;
        triggerType: AlertTriggerType;
    };

    genome?: {
        type: string;
        encoding: 'json' | 'text' | 'base64';
        data: any;
    };

    lineage?: {
        parents?: string[];
        generation?: number;
        operators?: string[];
    };

    behaviorTrace?: BehaviorTrace;

    xenobiologistReport: XenobiologistReport;

    researcherInterventions?: Array<Record<string, unknown>>;

    environmentSnapshot?: Record<string, unknown>;

    validationMetrics?: {
        stateBoundsViolationRate: number;
        diversityFloorViolationFraction: number;
        controlBoundsViolationRate: number;
    };

    runContext?: {
        bestAgencySoFar?: number;
        runId?: string;
        seed?: number;
        appVersion?: string;
    };

    derived?: {
        similarityVector?: number[];
        clusterId?: string;
    };
}

export interface LibraryIndexEntry {
    id: string;
    createdAt: string;
    name: string;
    tags: string[];
    scenario: LibraryEntry['scenario'];
    metrics: EmergenceMetrics;
}

export interface LegacyAgent {
    id: string;
    timestamp: string;
    name?: string;
    description?: string;
    tags?: string[];
    generation: number;
    metrics: {
        A: number;
        C: number;
        D: number;
        alertRate: number;
        cognitiveHorizon?: number;
        competency?: number;
    };
    parameters: Record<string, unknown>;
    environmentalControl: { U: number };
    historySnippet?: Array<Record<string, unknown>>;
    validationMetrics?: {
        stateBoundsViolationRate: number;
        diversityFloorViolationFraction: number;
        controlBoundsViolationRate: number;
    };
    runContext?: {
        bestAgencySoFar?: number;
    };
}

interface MigrationContext {
    scenario?: LibraryEntry['scenario'];
    alertThreshold?: number;
    triggerType?: AlertTriggerType;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isFiniteNumber = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value)
);

const isString = (value: unknown): value is string => typeof value === 'string';

const isStringArray = (value: unknown): value is string[] => (
    Array.isArray(value) && value.every(isString)
);

export const isLegacyAgent = (value: unknown): value is LegacyAgent => {
    if (!isRecord(value)) return false;
    if (!isString(value.id)) return false;
    if (!isString(value.timestamp)) return false;
    if (!isFiniteNumber(value.generation)) return false;
    if (!isRecord(value.metrics)) return false;
    if (!isFiniteNumber(value.metrics.A) || !isFiniteNumber(value.metrics.C)) return false;
    if (!isFiniteNumber(value.metrics.D) || !isFiniteNumber(value.metrics.alertRate)) return false;
    if (!isRecord(value.parameters)) return false;
    if (!isRecord(value.environmentalControl) || !isFiniteNumber(value.environmentalControl.U)) return false;
    return true;
};

export const isLibraryEntry = (value: unknown): value is LibraryEntry => {
    if (!isRecord(value)) return false;
    if (!isString(value.schemaVersion) || value.schemaVersion !== LIBRARY_SCHEMA_VERSION) return false;
    if (!isString(value.id) || !isString(value.createdAt)) return false;
    if (!isRecord(value.scenario)) return false;
    if (!isString(value.scenario.id) || !isString(value.scenario.name) || !isString(value.scenario.version)) return false;
    if (!isString(value.scenario.type)) return false;
    if (!isRecord(value.metricsAtEmergence)) return false;
    if (!isFiniteNumber(value.metricsAtEmergence.A)) return false;
    if (!isFiniteNumber(value.metricsAtEmergence.C)) return false;
    if (!isFiniteNumber(value.metricsAtEmergence.D)) return false;
    if (!isFiniteNumber(value.metricsAtEmergence.U)) return false;
    if (!isFiniteNumber(value.metricsAtEmergence.alertRate)) return false;
    if (!isFiniteNumber(value.metricsAtEmergence.generation)) return false;
    if (!isRecord(value.alertDetails)) return false;
    if (!isFiniteNumber(value.alertDetails.threshold) || !isFiniteNumber(value.alertDetails.confidence)) return false;
    if (!isString(value.alertDetails.triggerType)) return false;
    if (!isRecord(value.xenobiologistReport)) return false;
    if (!isString(value.xenobiologistReport.name)) return false;
    if (!isString(value.xenobiologistReport.specSheet)) return false;
    if (!isStringArray(value.xenobiologistReport.tags)) return false;
    return true;
};

export const migrateLegacyToLibrary = (legacy: LegacyAgent, context: MigrationContext = {}): LibraryEntry => {
    const inferScenario = (): LibraryEntry['scenario'] => {
        const tags = (legacy.tags || []).map(tag => tag.toLowerCase());
        if (tags.some(tag => tag.includes('math') || tag.includes('prover'))) {
            return { id: 'math', name: 'Mathematical Challenge Arena', type: 'math', version: '0.2.0' };
        }
        if (tags.some(tag => tag.includes('bio') || tag.includes('xenobiology') || tag.includes('ati'))) {
            return { id: 'bio', name: 'Xenobiology Lab', type: 'bio', version: '0.1.0' };
        }
        if (tags.some(tag => tag.includes('alignment') || tag.includes('safety'))) {
            return { id: 'alignment', name: 'AI Alignment Sandbox', type: 'alignment', version: '0.1.0' };
        }
        if (tags.some(tag => tag.includes('agents-scenario') || tag.includes('task decomposition'))) {
            return { id: 'agents', name: 'Emergent Task Decomposition', type: 'agents', version: '0.1.0' };
        }
        return { id: 'sde-v1', name: 'SDE Macro-Dynamics (v1)', type: 'sde', version: '1.0.0' };
    };

    const scenario: LibraryEntry['scenario'] = context.scenario || inferScenario();

    const threshold = context.alertThreshold ?? 0.75;
    const triggerType: AlertTriggerType = context.triggerType || 'threshold';

    return {
        schemaVersion: LIBRARY_SCHEMA_VERSION,
        id: legacy.id,
        createdAt: legacy.timestamp,
        scenario,
        metricsAtEmergence: {
            A: legacy.metrics.A,
            C: legacy.metrics.C,
            D: legacy.metrics.D,
            U: legacy.environmentalControl.U,
            alertRate: legacy.metrics.alertRate,
            generation: legacy.generation,
            cognitiveHorizon: legacy.metrics.cognitiveHorizon,
            competency: legacy.metrics.competency
        },
        alertDetails: {
            threshold,
            confidence: legacy.metrics.A >= threshold ? 1 : 0.7,
            triggerType
        },
        genome: {
            type: scenario.type === 'sde' ? 'sde-params' : 'legacy-params',
            encoding: 'json',
            data: legacy.parameters
        },
        xenobiologistReport: {
            name: legacy.name || `Agent-${legacy.id.substring(0, 6)}`,
            specSheet: legacy.description || 'Legacy agent migrated to Library schema.',
            tags: legacy.tags || [],
            cognitiveHorizon: legacy.metrics.cognitiveHorizon,
            competency: legacy.metrics.competency
        },
        researcherInterventions: legacy.historySnippet || [],
        environmentSnapshot: {
            parameters: legacy.parameters,
            control: legacy.environmentalControl
        },
        validationMetrics: legacy.validationMetrics,
        runContext: legacy.runContext
    };
};

export const toLibraryIndexEntry = (entry: LibraryEntry): LibraryIndexEntry => ({
    id: entry.id,
    createdAt: entry.createdAt,
    name: entry.xenobiologistReport.name,
    tags: entry.xenobiologistReport.tags,
    scenario: entry.scenario,
    metrics: entry.metricsAtEmergence
});

export const normalizeAgentEntry = (
    value: unknown,
    context: MigrationContext = {}
): { entry: LibraryEntry | null; migrated: boolean } => {
    if (isLibraryEntry(value)) {
        return { entry: value, migrated: false };
    }
    if (isRecord(value) && isString(value.schemaVersion)) {
        const scenarioFromLegacy = isRecord(value.scenario)
            ? {
                id: isString(value.scenario.id) ? value.scenario.id : (isString(value.scenarioId) ? value.scenarioId : 'unknown'),
                name: isString(value.scenario.name) ? value.scenario.name : (isString(value.scenarioId) ? value.scenarioId : 'Unknown Scenario'),
                type: isString(value.scenario.type) ? value.scenario.type as ScenarioType : ('sde' as ScenarioType),
                version: isString(value.scenario.version) ? value.scenario.version : (isString(value.scenarioVersion) ? value.scenarioVersion : '0.0.0')
            }
            : {
                id: isString(value.scenarioId) ? value.scenarioId : 'unknown',
                name: isString(value.scenarioId) ? value.scenarioId : 'Unknown Scenario',
                type: isString(value.scenarioType) ? value.scenarioType as ScenarioType : ('sde' as ScenarioType),
                version: isString(value.scenarioVersion) ? value.scenarioVersion : '0.0.0'
            };

        if (isRecord(value.metricsAtEmergence) && isRecord(value.alertDetails) && isRecord(value.xenobiologistReport)) {
            const metrics = value.metricsAtEmergence;
            const alert = value.alertDetails;
            const report = value.xenobiologistReport;
            const entry: LibraryEntry = {
                schemaVersion: LIBRARY_SCHEMA_VERSION,
                id: isString(value.id) ? value.id : 'unknown',
                createdAt: isString(value.createdAt) ? value.createdAt : (isString(value.timestamp) ? value.timestamp : new Date().toISOString()),
                scenario: scenarioFromLegacy,
                metricsAtEmergence: {
                    A: isFiniteNumber(metrics.A) ? metrics.A : 0,
                    C: isFiniteNumber(metrics.C) ? metrics.C : 0,
                    D: isFiniteNumber(metrics.D) ? metrics.D : 0,
                    U: isFiniteNumber(metrics.U) ? metrics.U : 0,
                    alertRate: isFiniteNumber(metrics.alertRate) ? metrics.alertRate : 0,
                    generation: isFiniteNumber(metrics.generation) ? metrics.generation : 0,
                    cognitiveHorizon: isFiniteNumber(metrics.cognitiveHorizon) ? metrics.cognitiveHorizon : undefined,
                    competency: isFiniteNumber(metrics.competency) ? metrics.competency : undefined
                },
                alertDetails: {
                    threshold: isFiniteNumber(alert.threshold) ? alert.threshold : 0.75,
                    confidence: isFiniteNumber(alert.confidence) ? alert.confidence : 0.8,
                    triggerType: isString(alert.triggerType) ? alert.triggerType as AlertTriggerType : 'threshold'
                },
                genome: isRecord(value.genome) ? value.genome : undefined,
                lineage: isRecord(value.lineage) ? value.lineage : undefined,
                behaviorTrace: isRecord(value.behaviorTrace) ? value.behaviorTrace : undefined,
                xenobiologistReport: {
                    name: isString(report.name) ? report.name : 'Unknown Agent',
                    specSheet: isString(report.specSheet) ? report.specSheet : 'Legacy entry migrated to current schema.',
                    tags: isStringArray(report.tags) ? report.tags : []
                },
                researcherInterventions: Array.isArray(value.researcherInterventions) ? value.researcherInterventions : undefined,
                environmentSnapshot: isRecord(value.environmentSnapshot) ? value.environmentSnapshot : undefined,
                validationMetrics: isRecord(value.validationMetrics) ? value.validationMetrics : undefined,
                runContext: isRecord(value.runContext) ? value.runContext : undefined,
                derived: isRecord(value.derived) ? value.derived : undefined
            };
            return { entry, migrated: true };
        }
    }
    if (isLegacyAgent(value)) {
        return { entry: migrateLegacyToLibrary(value, context), migrated: true };
    }
    return { entry: null, migrated: false };
};
