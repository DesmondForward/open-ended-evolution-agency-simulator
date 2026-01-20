
/**
 * Types for the Math Challenge Scenario
 */

// A mathematical task to be solved
export interface MathTask {
    id: string;
    difficulty: number; // 0-1, maps to U
    type: 'algebra_linear' | 'algebra_quadratic' | 'number_theory';
    statement: string; // Human readable

    // The "verifier" function logic is implicit in the class, 
    // but here we store parameters needed to check answer
    targetValue?: number;
    coefficients?: number[];
}

// A genome representing a solver strategy
// MVP: A simple numeric array representing bias/weights or a tiny DSL string
export interface MathGenome {
    id: string;
    type: 'numeric_weights' | 'dsl';
    data: number[] | string;

    // Performance stats
    solvedCount: number;
    complexityScore: number;
}

// State of the Math World
export interface MathState {
    generation: number;

    // Population
    agents: MathGenome[];

    // Current Active Tasks
    currentTasks: MathTask[];

    // Metrics
    metrics: {
        C: number; // Avg complexity of population + tasks
        D: number; // Diversity of genomes
        A: number; // Agency: success rate vs difficulty
        U: number; // Current environmental difficulty
        alertRate: number;
    }
}

export interface MathConfig {
    populationSize: number;
    mutationRate: number;
    tasksPerGen: number;
}

export const DEFAULT_MATH_CONFIG: MathConfig = {
    populationSize: 50,
    mutationRate: 0.1,
    tasksPerGen: 10
};
