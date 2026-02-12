export type ScenarioType = 'sde' | 'math' | 'alignment' | 'bio' | 'agents';

export interface AiLogPayload {
    generation: number;
    action: string;
    u: number;
    params?: Record<string, unknown>;
    reasoning?: string;
    agency: number;
    bestAgency: number;
}

export interface AiControlRequestPayload {
    state: {
        C: number;
        D: number;
        A: number;
        alertRate: number;
        generation: number;
    };
    currentParams: Record<string, unknown>;
    control: { U: number };
    scenarioMetadata: {
        id: string;
        name: string;
        description: string;
        version: string;
        type: ScenarioType;
    };
    history?: Array<{
        generation: number;
        action: string;
        u: number;
        params?: Record<string, unknown>;
        reasoning: string;
        outcome: { A_before: number; A_after: number; delta_A: number };
    }>;
    bestAgency?: number;
    bestParams?: Record<string, unknown> | null;
    bestControl?: { U: number } | null;
}

export interface AiControlResponsePayload {
    u: number;
    reasoning: string;
    params?: Record<string, unknown>;
}

export interface AiDescriptionRequestPayload {
    agentData: {
        id: string;
        timestamp: string;
        generation: number;
        metrics: { A: number; C: number; D: number; alertRate: number };
        parameters: Record<string, unknown>;
        environmentalControl: { U: number };
        historySnippet: Array<Record<string, unknown>>;
        validationMetrics: {
            stateBoundsViolationRate: number;
            diversityFloorViolationFraction: number;
            controlBoundsViolationRate: number;
        };
        runContext: { bestAgencySoFar: number };
    };
}

export interface AiDescriptionResponsePayload {
    name: string;
    description: string;
    tags: string[];
    cognitiveHorizon: number;
    competency: number;
}

export interface SaveAgentPayload {
    id: string;
    timestamp?: string;
}

export interface DeleteAgentPayload {
    id: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value);
};

const isString = (value: unknown): value is string => typeof value === 'string';

const isStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.every(isString);
};

const isScenarioType = (value: unknown): value is ScenarioType => {
    return value === 'sde' || value === 'math' || value === 'alignment' || value === 'bio' || value === 'agents';
};

export const validateAiLogPayload = (value: unknown): value is AiLogPayload => {
    if (!isRecord(value)) return false;
    if (!isFiniteNumber(value.generation)) return false;
    if (!isString(value.action)) return false;
    if (!isFiniteNumber(value.u)) return false;
    if (!isFiniteNumber(value.agency)) return false;
    if (!isFiniteNumber(value.bestAgency)) return false;
    if (value.reasoning !== undefined && !isString(value.reasoning)) return false;
    if (value.params !== undefined && !isRecord(value.params)) return false;
    return true;
};

export const validateAiControlRequestPayload = (value: unknown): value is AiControlRequestPayload => {
    if (!isRecord(value)) return false;
    if (!isRecord(value.state)) return false;
    if (!isRecord(value.control)) return false;
    if (!isRecord(value.scenarioMetadata)) return false;
    if (!isFiniteNumber(value.state.C) || !isFiniteNumber(value.state.D) || !isFiniteNumber(value.state.A)) return false;
    if (!isFiniteNumber(value.state.alertRate) || !isFiniteNumber(value.state.generation)) return false;
    if (!isFiniteNumber(value.control.U)) return false;
    if (!isString(value.scenarioMetadata.id) || !isString(value.scenarioMetadata.name)) return false;
    if (!isString(value.scenarioMetadata.description) || !isString(value.scenarioMetadata.version)) return false;
    if (!isScenarioType(value.scenarioMetadata.type)) return false;
    if (value.history !== undefined && !Array.isArray(value.history)) return false;
    return true;
};

export const validateAiControlResponsePayload = (value: unknown): value is AiControlResponsePayload => {
    if (!isRecord(value)) return false;
    if (!isFiniteNumber(value.u)) return false;
    if (!isString(value.reasoning)) return false;
    if (value.params !== undefined && !isRecord(value.params)) return false;
    return true;
};

export const validateAiDescriptionRequestPayload = (value: unknown): value is AiDescriptionRequestPayload => {
    if (!isRecord(value)) return false;
    if (!isRecord(value.agentData)) return false;
    if (!isString(value.agentData.id)) return false;
    if (!isString(value.agentData.timestamp)) return false;
    if (!isFiniteNumber(value.agentData.generation)) return false;
    if (!isRecord(value.agentData.metrics)) return false;
    if (!isFiniteNumber(value.agentData.metrics.A) || !isFiniteNumber(value.agentData.metrics.C)) return false;
    if (!isFiniteNumber(value.agentData.metrics.D) || !isFiniteNumber(value.agentData.metrics.alertRate)) return false;
    if (!isRecord(value.agentData.environmentalControl) || !isFiniteNumber(value.agentData.environmentalControl.U)) return false;
    return true;
};

export const validateAiDescriptionResponsePayload = (value: unknown): value is AiDescriptionResponsePayload => {
    if (!isRecord(value)) return false;
    if (!isString(value.name)) return false;
    if (!isString(value.description)) return false;
    if (!isStringArray(value.tags)) return false;
    // Optional fields don't need strict type checks if we trust they are number | undefined, 
    // but good to check if present they are numbers.
    if (value.cognitiveHorizon !== undefined && !isFiniteNumber(value.cognitiveHorizon)) return false;
    if (value.competency !== undefined && !isFiniteNumber(value.competency)) return false;
    return true;
};

export const validateSaveAgentPayload = (value: unknown): value is SaveAgentPayload => {
    if (!isRecord(value)) return false;
    if (!isString(value.id)) return false;
    if (value.timestamp !== undefined && !isString(value.timestamp)) return false;
    return true;
};

export const validateDeleteAgentPayload = (value: unknown): value is DeleteAgentPayload => {
    if (!isRecord(value)) return false;
    if (!isString(value.id)) return false;
    return true;
};
