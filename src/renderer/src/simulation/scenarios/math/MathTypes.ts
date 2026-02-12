
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
    authorId: string;
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
    type: 'numeric_weights' | 'dsl' | 'ast';
    data: number[] | string | ASTGenomeData;

    // Performance stats
    solvedCount: number;
    complexityScore: number;

    // NCG stats
    claimsGenerated: number;
    theoremsProven: number;
}

/**
 * AST-based genome data for neuro-symbolic evolution.
 * Instead of evolving weights, we evolve program structures directly.
 */
export interface ASTGenomeData {
    // The "strategy" expression: how the agent approaches problem solving
    solverStrategy: MathExpression;
    // Template for generating conjectures
    conjectureTemplate: MathExpression;
    // Mutation parameters that evolve alongside the AST
    mutationBias: {
        preferVariables: number;   // 0-1: tendency to use variables vs constants
        preferComplex: number;     // 0-1: tendency for deep vs shallow trees
        operatorWeights: Record<MathOperator, number>; // relative weights for each operator
    };

    // Neural Guidance (Neuro-Symbolic)
    neuralGuide?: NeuralGenomeData;
}

export interface NeuralGenomeData {
    weights: any; // Serialized weights of the NeuralGuide
    config: any;  // Configuration of the NeuralGuide
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
    mutationRate: 0.15,
    tasksPerGen: 40,
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
