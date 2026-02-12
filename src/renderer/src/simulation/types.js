/**
 * Simulation Types for Open-Ended Virtual Evolution Simulator
 * Based on the SDE model from the PRD schema
 */
/** Default initial conditions from the PRD */
export const DEFAULT_INITIAL_STATE = {
    C: 0.05,
    D: 0.6,
    A: 0.02,
    alertRate: 0,
    generation: 0
};
/** Default parameters from the PRD */
export const DEFAULT_PARAMETERS = {
    k_CD: 0.12,
    k_AC: 0.10,
    k_DU: 0.35,
    k_U: 0.08,
    sigma_C: 0.005, // Lowered for stability as per log findings
    sigma_D: 0.02,
    sigma_A: 0.005, // Lowered for stability
    tau: 5,
    eps: 0.05,
    A_alert: 0.75, // Updated target
    dt: 0.1,
    useGPU: false,
    // New defaults matching original hardcoded values
    k_C_decay: 0.3,
    k_D_growth: 0.25,
    k_D_decay: 0.15,
    k_AU: 0.4,
    k_A_decay: 0.35
};
/** Default control signal */
export const DEFAULT_CONTROL = {
    U: 0.2
};
