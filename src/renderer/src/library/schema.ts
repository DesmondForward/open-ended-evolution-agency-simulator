import { SimulationParameters, ControlSignal, ValidationMetrics, AIHistoryEntry } from '../simulation/types';

/**
 * Legacy V1 Schema
 * Defined to match existing SavedAgent interface
 */
export interface LibraryEntryV1 {
    id: string;
    timestamp: string; // ISO String
    name: string;
    description: string;
    tags: string[];

    // Snapshot of emergence state
    generation: number;
    metrics: {
        A: number;
        C: number;
        D: number;
        alertRate: number;
    };

    // The "DNA"
    parameters: SimulationParameters;

    // Context
    environmentalControl: ControlSignal;
    historySnippet: AIHistoryEntry[];

    // Additional Context
    validationMetrics: ValidationMetrics;
    runContext: {
        bestAgencySoFar: number;
    };

    // No schemaVersion field in V1
}

/**
 * V2 Library Entry Schema
 */
export interface LibraryEntryV2 {
    schemaVersion: '2.0.0';

    // Core Identity
    id: string;
    createdAt: string; // ISO String
    scenarioId: string; // "sde", "math", "alignment", "bio"
    scenarioVersion: string;

    // Emergence Context
    metricsAtEmergence: {
        C: number;
        D: number;
        A: number;
        U: number;
        alertRate: number;
        generation: number;
    };

    alertDetails: {
        threshold: number;
        confidence: number;
        triggerType: 'peak' | 'threshold' | 'sustained';
    };

    // Evolution / Agent Payload
    genome?: {
        type: string; // "sde-params", "dsl-program", "neural-weights", "bitstring"
        encoding: 'json' | 'text' | 'base64';
        data: any;
    };

    lineage?: {
        parents: string[]; // UUIDs
        generation: number;
        operators: string[];
    };

    // Behavioral Analysis
    behaviorTrace?: {
        summary: string;
        uri?: string; // pointer to separate large file
    };

    // AI Analysis
    xenobiologistReport: {
        name: string;
        specSheet: string;
        tags: string[];
        narrative?: string;
    };

    researcherInterventions?: any[];

    // Replay Data
    environmentSnapshot: any;
}

export type LibraryEntry = LibraryEntryV1 | LibraryEntryV2;

/**
 * Type Guard for V2
 */
export function isV2Entry(entry: LibraryEntry): entry is LibraryEntryV2 {
    return (entry as LibraryEntryV2).schemaVersion === '2.0.0';
}
