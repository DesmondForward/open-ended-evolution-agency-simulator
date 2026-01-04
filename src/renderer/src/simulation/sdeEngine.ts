/**
 * SDE Engine - Euler-Maruyama Integration for Open-Ended Evolution
 * 
 * Implements the stochastic differential equations from the PRD:
 * - E1: dC = (k_CD*D*(1-C) + k_U*U*(1-C) - 0.3*C) dt + sigma_C*dW_C
 * - E2: dD = (0.25*(1-D) - k_DU*U*D - 0.15*D^2) dt + sigma_D*dW_D  
 * - E3: dA = (k_AC*C*(1-A) + 0.4*U*C*(1-A) - 0.35*A) dt + sigma_A*dW_A
 * - E4: dA_alert_rate = (1/tau)*sigmoid((A - A_alert)/eps) dt
 */

import { SimulationState, SimulationParameters, ControlSignal } from './types';

/**
 * Box-Muller transform for generating Gaussian random numbers
 */
function gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Sigmoid function for smooth thresholding
 */
function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

/**
 * Clamp a value to [0, 1] bounds
 */
function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

/**
 * Compute the drift terms for the SDE system
 */
export function computeDrift(
    state: SimulationState,
    params: SimulationParameters,
    control: ControlSignal
): { dC: number; dD: number; dA: number; dAlertRate: number } {
    const { C, D, A, alertRate } = state;
    const { k_CD, k_AC, k_DU, k_U, tau, eps, A_alert, dt } = params;
    const { U } = control;

    // E1: Complexity dynamics
    // Grows via diversity-driven innovation and difficulty-driven challenge
    // Decays via simplification/selection bottlenecks
    const dC = (k_CD * D * (1 - C) + k_U * U * (1 - C) - 0.3 * C) * dt;

    // E2: Diversity dynamics
    // Increases through mutation/niche creation
    // Decreases under harsh environments and saturation effects
    const dD = (0.25 * (1 - D) - k_DU * U * D - 0.15 * D * D) * dt;

    // E3: Agency dynamics
    // Emerges from complexity and is accelerated by challenge
    // Bounded by normalization and decays without sustained adaptation
    const dA = (k_AC * C * (1 - A) + 0.4 * U * C * (1 - A) - 0.35 * A) * dt;

    // E4: Alert rate dynamics
    // Smooth alert-rate process for robust threshold crossing detection
    const alertSignal = sigmoid((A - A_alert) / eps);
    const dAlertRate = (1 / tau) * alertSignal * dt;

    return { dC, dD, dA, dAlertRate };
}

/**
 * Compute the diffusion (noise) terms for the SDE system
 */
function computeDiffusion(
    params: SimulationParameters
): { noiseC: number; noiseD: number; noiseA: number } {
    const { sigma_C, sigma_D, sigma_A, dt } = params;
    const sqrtDt = Math.sqrt(dt);

    return {
        noiseC: sigma_C * gaussianRandom() * sqrtDt,
        noiseD: sigma_D * gaussianRandom() * sqrtDt,
        noiseA: sigma_A * gaussianRandom() * sqrtDt
    };
}

/**
 * Perform one Euler-Maruyama integration step
 * 
 * This is the core simulation update that advances the state by dt
 */
export function eulerMaruyamaStep(
    state: SimulationState,
    params: SimulationParameters,
    control: ControlSignal
): SimulationState {
    // Compute deterministic drift
    const drift = computeDrift(state, params, control);

    // Compute stochastic diffusion
    const noise = computeDiffusion(params);

    // Update state with bounds enforcement
    const newC = clamp01(state.C + drift.dC + noise.noiseC);
    const newD = clamp01(state.D + drift.dD + noise.noiseD);
    const newA = clamp01(state.A + drift.dA + noise.noiseA);
    const newAlertRate = Math.max(0, state.alertRate + drift.dAlertRate);

    return {
        C: newC,
        D: newD,
        A: newA,
        alertRate: newAlertRate,
        generation: state.generation + params.dt
    };
}

/**
 * Run multiple simulation steps
 */
export function runSimulationSteps(
    initialState: SimulationState,
    params: SimulationParameters,
    control: ControlSignal,
    numSteps: number
): SimulationState {
    let state = initialState;
    for (let i = 0; i < numSteps; i++) {
        state = eulerMaruyamaStep(state, params, control);
    }
    return state;
}

/**
 * Check if an alert should be triggered
 */
export function shouldTriggerAlert(
    state: SimulationState,
    params: SimulationParameters
): boolean {
    return state.A >= params.A_alert;
}

/**
 * Calculate validation metrics for current state
 */
export function calculateValidationMetrics(
    history: SimulationState[],
    params: SimulationParameters
): {
    stateBoundsViolationRate: number;
    diversityFloorViolationFraction: number;
} {
    if (history.length === 0) {
        return { stateBoundsViolationRate: 0, diversityFloorViolationFraction: 0 };
    }

    let boundsViolations = 0;
    let diversityFloorViolations = 0;

    for (const state of history) {
        // Check bounds (should never happen with clipping, but track anyway)
        if (state.C < 0 || state.C > 1 || state.D < 0 || state.D > 1 || state.A < 0 || state.A > 1) {
            boundsViolations++;
        }
        // Check diversity floor (D >= 0.2 preferred)
        if (state.D < 0.2) {
            diversityFloorViolations++;
        }
    }

    return {
        stateBoundsViolationRate: boundsViolations / history.length,
        diversityFloorViolationFraction: diversityFloorViolations / history.length
    };
}
