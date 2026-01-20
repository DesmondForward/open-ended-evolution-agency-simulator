
/**
 * Types for the Xenobiology Scenario
 */

// Genetic Traits
export interface BioGenome {
    id: string;
    // 0-1 scale
    metabolism: number; // Efficiency. Higher = less base cost, but maybe slower action?
    reproductionRate: number; // Higher = faster breeding
    toxinResistance: number; // Higher = resists U damage, but costs energy

    generation: number;
    parent?: string;
}

export interface BioAgentState {
    id: string;
    energy: number;
    age: number;
}

export interface BioState {
    generation: number;
    agents: BioAgentState[];
    genomes: Record<string, BioGenome>;

    // Environment
    totalAvailableEnergy: number; // Renewed each tick
    toxicity: number; // U

    metrics: {
        C: number;
        D: number;
        A: number;
        U: number;
        alertRate: number;

        populationSize: number;
        avgResistance: number;
    }
}

export interface BioConfig {
    initialPopulation: number;
    maxPopulation: number;
    mutationRate: number;
    energyPerTick: number; // Influx
}

export const DEFAULT_BIO_CONFIG: BioConfig = {
    initialPopulation: 50,
    maxPopulation: 500,
    mutationRate: 0.1,
    energyPerTick: 1000 // Distributed among agents
};
