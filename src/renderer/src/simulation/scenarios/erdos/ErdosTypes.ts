export type ProblemDomain = 'additive_number_theory' | 'combinatorics' | 'graph_theory' | 'geometry';

export interface ErdosProblem {
    id: string;
    title: string;
    description: string;
    domain: ProblemDomain;
    difficulty: number; // 0-1
    reward: number;
    solved: boolean;
    solutionQuality: number;
    lastStatusUpdate: string;
    steps: string[];
    agents: Array<{ name: string; id: string }>;
    copyAction: string;
}

export interface DiscoveryAgent {
    id: string;
    specialization: ProblemDomain;
    creativity: number;
    rigor: number;
    collaboration: number;
    solvedCount: number;
}

export interface ErdosConfig {
    populationSize: number;
    problemsPerGeneration: number;
    mutationRate: number;
    collaborationBoost: number;
}

export const DEFAULT_ERDOS_CONFIG: ErdosConfig = {
    populationSize: 36,
    problemsPerGeneration: 1,
    mutationRate: 0.12,
    collaborationBoost: 0.3
};

export interface ErdosMetrics {
    C: number;
    D: number;
    A: number;
    U: number;
    alertRate: number;
    solvedRatio: number;
    activeProblems: number;
    cumulativeReward: number;
    cognitiveLightCone: number;
}

export interface ErdosState {
    generation: number;
    nextProblemIndex: number;
    agents: DiscoveryAgent[];
    activeProblems: ErdosProblem[];
    solvedProblems: ErdosProblem[];
    metrics: ErdosMetrics;
}
