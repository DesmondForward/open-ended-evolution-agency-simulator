
/**
 * Types for the Emergent Task Decomposition (ETD) Scenario
 */

// A primitive action or sub-problem type
export type ActionType = 'NAVIGATE' | 'COMPUTE' | 'MANIPULATE' | 'COMMUNICATE';

// A skill is a stored procedure that solves a specific pattern of requirements
export interface AgentSkill {
    id: string;
    name: string;
    targetTypes: ActionType[];
    efficiency: number; // Multiplier reduces cost (e.g. 0.5 = half cost)
    complexity: number; // Cost to maintain this skill
    usageCount: number;
}

// A task consists of a set of requirements
export interface AgentTask {
    id: string;
    requirements: Record<ActionType, number>; // e.g. { NAVIGATE: 10, COMPUTE: 50 }
    deadline: number;
    driftFactor: number; // How much this task deviates from "standard"
}

// Genome defines strategy
export interface AgentGenome {
    id: string;

    // Strategy Parameters
    planDepth: number;          // How deep to decompose
    skillCreationThreshold: number; // When to cache a solution as a skill
    toolboxSizeLimit: number;   // Max skills to keep

    // Learning Weights
    learningRate: number;
}

export interface AgentMetrics {
    C: number;
    D: number;
    A: number;
    U: number;
    alertRate: number;

    // ETD Specific
    skillReuseRate: number;
    averageToolboxSize: number;
    taskSuccessRate: number;

    // Agency Recommendation Metrics
    H: number;   // World Uncertainty
    E: number;   // Energy Spent
    BV: number;  // Behavioral Variance
    AFG: number; // Adaptive Feedback Gain
    EI: number;  // Emergent Intention Score
}

export interface AgentConfig {
    populationSize: number;
    tasksPerGen: number;
    baseTaskDifficulty: number;
    driftRate: number; // How fast task distribution changes
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
    populationSize: 30,
    tasksPerGen: 10,
    baseTaskDifficulty: 20,
    driftRate: 0.1
};

export interface AgentEntity {
    id: string;
    lineageId: string; // Tracks the evolutionary line
    parentId?: string; // Direct parent ID
    birthGeneration: number;

    genome: AgentGenome;
    skills: AgentSkill[];
    energy: number;
    score: number;

    // For calculating BV (Behavioral Variance)
    previousPolicyState?: number[];
}

export interface AgentScenarioState {
    generation: number;
    agents: AgentEntity[];
    currentTasks: AgentTask[];
    metrics: AgentMetrics;
}
