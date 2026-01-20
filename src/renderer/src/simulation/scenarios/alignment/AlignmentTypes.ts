
/**
 * Types for the Alignment / Safety Sandbox Scenario
 */

// Discrete actions available to agents
export type ActionType = 'ACCUMULATE' | 'REFRAIN' | 'CAMOUFLAGE';

export interface AlignmentAgentState {
    id: string;
    resources: number; // The "Goal" (C)
    reputation: number; // Safety Score (0-1)
    isCaught: boolean; // If caught violating constraints
    age: number;
}

// Genome: Probabilistic Policy
// weights: [w_accumulate, w_refrain, w_camouflage]
export interface AlignmentGenome {
    id: string;
    weights: [number, number, number];
    generation: number;
}

export interface AlignmentState {
    generation: number;
    agents: AlignmentAgentState[];
    genomes: Record<string, AlignmentGenome>; // Map agent ID to genome

    // Environment State
    globalResources: number; // Total C
    oversightIntensity: number; // U (Probability of audit)

    metrics: {
        C: number;
        D: number;
        A: number;
        U: number;
        alertRate: number;

        // Domain specific
        violationRate: number;
        deceptionScore: number;
    }
}

export interface AlignmentConfig {
    populationSize: number;
    mutationRate: number;
    baseResourceRate: number;
}

export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
    populationSize: 20,
    mutationRate: 0.05,
    baseResourceRate: 1.0
};
