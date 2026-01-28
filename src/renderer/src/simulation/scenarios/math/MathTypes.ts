
/**
 * Types for the Math Challenge Scenario (NCG Enhanced)
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

// Low-level representation of a math formula/statment
export type MathOperator = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'POW' | 'MOD' | 'EQ';

export interface MathExpression {
    type: 'ATOM' | 'OP';
    value?: number | string; // number for constants, string for variables
    left?: MathExpression;
    right?: MathExpression;
    op?: MathOperator;
}

export interface MathProof {
    steps: string[];
    axiomsUsed: string[];
    isValid: boolean;
}

export interface MathClaim {
    id: string;
    expression: MathExpression;
    text: string; // Readable form
    noveltyScore: number;
    evidenceCount: number; // partial verification
    proven: boolean;
    proof?: MathProof;
    counterExample?: Record<string, number>;
}

// A genome representing a solver strategy
export interface MathGenome {
    id: string;
    type: 'numeric_weights' | 'dsl';
    data: number[] | string;

    // Performance stats
    solvedCount: number;
    complexityScore: number;

    // NCG stats
    claimsGenerated: number;
    theoremsProven: number;
}

export interface MathConfig {
    populationSize: number;
    mutationRate: number;
    tasksPerGen: number;

    // NCG Config
    difficultyScale: number;
    noveltyThreshold: number;
    verificationBudget: number;
    enableTheorems: boolean; // Ablation
}

export const DEFAULT_MATH_CONFIG: MathConfig = {
    populationSize: 50,
    mutationRate: 0.1,
    tasksPerGen: 10,
    difficultyScale: 1.0,
    noveltyThreshold: 0.5,
    verificationBudget: 100,
    enableTheorems: true
};

export interface MathMetrics {
    C: number;
    D: number;
    A: number;
    U: number;
    alertRate: number;

    // NCG Specific
    avgNovelty: number;
    totalProvenTheorems: number;
    falsificationRate: number;
}

// State of the Math World
export interface MathState {
    generation: number;

    // Population
    agents: MathGenome[];

    // Current Active Tasks (Standard Curriculum)
    currentTasks: MathTask[];

    // Accumulated Knowledge (Theorems)
    claims: MathClaim[];

    // Metrics
    metrics: MathMetrics;
}
