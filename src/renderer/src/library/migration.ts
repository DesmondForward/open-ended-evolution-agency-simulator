import { LibraryEntryV1, LibraryEntryV2 } from './schema';

export function migrateV1ToV2(entry: LibraryEntryV1): LibraryEntryV2 {
    return {
        schemaVersion: '2.0.0',
        id: entry.id,
        createdAt: entry.timestamp,
        scenarioId: 'sde',
        scenarioVersion: '1.0.0', // Legacy SDE version
        metricsAtEmergence: {
            C: entry.metrics.C,
            D: entry.metrics.D,
            A: entry.metrics.A,
            U: entry.environmentalControl.U,
            alertRate: entry.metrics.alertRate,
            generation: entry.generation
        },
        alertDetails: {
            threshold: 0.75, // Default for V1
            confidence: 1.0,
            triggerType: 'threshold'
        },
        genome: {
            type: 'sde-params',
            encoding: 'json',
            data: entry.parameters
        },
        xenobiologistReport: {
            name: entry.name,
            specSheet: entry.description,
            tags: entry.tags
        },
        researcherInterventions: entry.historySnippet,
        environmentSnapshot: {
            // SDE state reconstruction
            parameters: entry.parameters,
            control: entry.environmentalControl,
            validationMetrics: entry.validationMetrics
        }
    };
}
