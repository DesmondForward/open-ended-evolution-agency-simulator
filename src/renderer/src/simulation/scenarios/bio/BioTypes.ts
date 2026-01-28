
/**
 * Types for the Xenobiology Scenario (ACE Enhanced)
 */

// ACE: Functional Groups
export type ResourceType = 'SUN' | 'MINERALS' | 'DETRITUS' | 'BIOMASS';

export interface Reaction {
    id: string;
    input: ResourceType;
    output: ResourceType;
    efficiency: number; // 0-1, how much energy is conserved
    yield: number; // coefficient of conversion
}

export interface MetabolicGraph {
    reactions: Reaction[];
}

// Genetic Traits
export interface BioGenome {
    id: string;
    // 0-1 scale
    metabolism: number; // Efficiency base
    reproductionRate: number;
    toxinResistance: number;
    foragingValence: number;

    // ACE: Metabolic capabilities
    // Genes encode which reactions are possible
    metabolicPathways: MetabolicGraph;

    generation: number;
    parent?: string;
}

export interface BioAgentState {
    id: string;
    energy: number;
    age: number;
    lastAction?: string;
    atiScore?: number;

    // Inventory
    storedResources: Record<ResourceType, number>;
}

export interface BioState {
    generation: number;
    agents: BioAgentState[];
    genomes: Record<string, BioGenome>;

    // Environment
    resources: Record<ResourceType, number>; // Abiotic pools
    toxicity: number; // U

    metrics: {
        C: number;
        D: number;
        A: number;
        U: number;
        alertRate: number;

        populationSize: number;
        avgResistance: number;

        // ACE Metrics
        functionalDiversity: number; // Distinct pathways count
        biomassThroughput: number;
        extinctionEvents: number;
    }
}

export interface BioConfig {
    initialPopulation: number;
    maxPopulation: number;
    mutationRate: number;
    energyPerTick: number; // SUN Influx
    mineralInflux: number;
}

export const DEFAULT_BIO_CONFIG: BioConfig = {
    initialPopulation: 50,
    maxPopulation: 500,
    mutationRate: 0.1,
    energyPerTick: 1000,
    mineralInflux: 100
};
