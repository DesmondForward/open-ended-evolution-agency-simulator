/**
 * Simulation Types for Open-Ended Virtual Evolution Simulator
 * Based on the SDE model from the PRD schema
 */

/** State variables of the simulation (all normalized 0-1) */
export interface SimulationState {
    /** Normalized ecosystem algorithmic complexity proxy */
    C: number;
    /** Normalized ecological diversity proxy */
    D: number;
    /** Normalized agency score proxy */
    A: number;
    /** Alert rate (derived from A crossing threshold) */
    alertRate: number;
    /** Current generation/timestep */
    generation: number;
}

/** Control signal applied by researcher */
export interface ControlSignal {
    /** Environment difficulty/novelty control (0-1) */
    U: number;
}

/** SDE Model Parameters */
export interface SimulationParameters {
    /** Diversity-to-complexity coupling rate (1/generation) */
    k_CD: number;
    /** Complexity-to-agency coupling rate (1/generation) */
    k_AC: number;
    /** Difficulty-driven selection pressure (1/generation) */
    k_DU: number;
    /** Difficulty-driven stimulation term (1/generation) */
    k_U: number;
    /** Stochasticity scale on complexity dynamics */
    sigma_C: number;
    /** Stochasticity scale on diversity dynamics */
    sigma_D: number;
    /** Stochasticity scale on agency dynamics */
    sigma_A: number;
    /** Alert rate time constant */
    tau: number;
    /** Sigmoid sharpness for alert calculation */
    eps: number;
    /** Agency alert threshold */
    A_alert: number;
    /** Timestep size (generations) */
    dt: number;
}

/** Known quantities from the PRD */
export interface KnownQuantities {
    /** World lattice size for spatial interactions */
    N_cells: number;
    /** Telemetry aggregation timestep */
    dt: number;
    /** Compute budget (GPUs) */
    B_gpu: number;
    /** Run length in generations */
    T_horizon: number;
    /** Agency alert threshold */
    A_alert: number;
}

/** Telemetry data point for charting */
export interface TelemetryPoint {
    generation: number;
    C: number;
    D: number;
    A: number;
    U: number;
    alertRate: number;
}

/** Alert event when agency crosses threshold */
export interface AlertEvent {
    id: string;
    generation: number;
    agencyLevel: number;
    timestamp: Date;
    type: 'threshold_crossed' | 'sustained_high' | 'peak';
}

/** Validation metrics from the PRD */
export interface ValidationMetrics {
    stateBoundsViolationRate: number;
    diversityFloorViolationFraction: number;
    controlBoundsViolationRate: number;
}

/** Default initial conditions from the PRD */
export const DEFAULT_INITIAL_STATE: SimulationState = {
    C: 0.05,
    D: 0.6,
    A: 0.02,
    alertRate: 0,
    generation: 0
};

/** Default parameters from the PRD */
export const DEFAULT_PARAMETERS: SimulationParameters = {
    k_CD: 0.12,
    k_AC: 0.10,
    k_DU: 0.35,
    k_U: 0.08,
    sigma_C: 0.03,
    sigma_D: 0.02,
    sigma_A: 0.05,
    tau: 5,
    eps: 0.05,
    A_alert: 0.7,
    dt: 0.1
};

/** Default control signal */
export const DEFAULT_CONTROL: ControlSignal = {
    U: 0.2
};
