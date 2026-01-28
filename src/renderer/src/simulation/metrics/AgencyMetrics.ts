
import { AgentTask, ActionType } from '../scenarios/agents/AgentTypes';

/**
 * Agency Metrics Calculator
 * Implements the "Emergent Intention" equations from the recommendation.
 */

// Math Helpers
const log2 = (x: number) => Math.log(x) / Math.LN2;

/**
 * 1. World Uncertainty (H)
 * Entropy of the current task requirement distribution.
 * H_t = -sum(p_i * log2(p_i))
 */
export function computeEntropy(tasks: AgentTask[]): number {
    if (tasks.length === 0) return 0;

    // Collect all requirement values to form a distribution
    const values: number[] = [];
    tasks.forEach(task => {
        Object.values(task.requirements).forEach(val => {
            if (val > 0) values.push(val);
        });
    });

    if (values.length === 0) return 0;

    const total = values.reduce((a, b) => a + b, 0);
    const pdf = values.map(v => v / total);

    let entropy = 0;
    for (const p of pdf) {
        if (p > 0) {
            entropy -= p * log2(p);
        }
    }
    return entropy;
}

/**
 * 2. Energy Efficiency (EE)
 * EE = (Delta H) / Energy
 * How much uncertainty did we reduce per unit of energy?
 */
export function computeEnergyEfficiency(
    entropyPrev: number,
    entropyCurrent: number,
    energySpent: number
): number {
    // If entropy increased (positive delta), EE is negative (bad). 
    // If entropy decreased (negative delta), we want positive EE.
    // So: -(H_current - H_prev) / Energy
    // Or: (H_prev - H_current) / Energy

    // Safety for div by zero
    const e = Math.max(0.0001, energySpent);
    const deltaH = entropyPrev - entropyCurrent;
    return deltaH / e;
}

/**
 * 3. Behavioral Variance (BV)
 * JS Divergence or Cosine Distance between policy states.
 * For this simplified agent model, we use Euclidean distance of the "Skill Efficiency State".
 */
export function computeBehavioralVariance(
    policyPrev: number[],
    policyCurrent: number[]
): number {
    if (!policyPrev || !policyCurrent || policyPrev.length !== policyCurrent.length) return 0;

    let sumSq = 0;
    for (let i = 0; i < policyPrev.length; i++) {
        const diff = policyPrev[i] - policyCurrent[i];
        sumSq += diff * diff;
    }
    return Math.sqrt(sumSq);
}

/**
 * 4. Adaptive Feedback Gain (AFG)
 * Ratio of Policy Change to Performance Change (or Feedback).
 * AFG = |Delta Policy| / (|Delta Score| + epsilon)
 * High AFG means small feedback causes large behavioral shifts (sensitive/learning).
 * Low AFG means behavior is stable despite feedback or needs huge feedback to change.
 */
export function computeFeedbackGain(
    policyChangeMagnitude: number, // BV
    scoreDelta: number
): number {
    return policyChangeMagnitude / (Math.abs(scoreDelta) + 1e-6);
}

/**
 * 5. Emergent Intention (EI)
 * The composite score.
 * EI = Sigmoid(alpha * EE + beta * AFG - delta * BV + gamma * TaskProgress)
 */
export function computeEmergentIntention(
    EE: number,
    AFG: number,
    BV: number,
    TaskProgress: number, // Normalized 0-1
    params = { alpha: 1.0, beta: 0.5, delta: 1.0, gamma: 1.0 }
): number {
    // We want: High EE, High AFG (initially), LOW BV (eventually), High TP.
    // Wait, the recommendation says: "Agency 'events' = local maxima of EI"
    // "Intuition: real intention should reduce uncertainty... internalize feedback... and stabilize (variance falls)."
    // So EI should be high when BV is LOW?
    // Formula from recomm: EE + AFG - BV + TP.

    const exponent = params.alpha * EE + params.beta * AFG - params.delta * BV + params.gamma * TaskProgress;

    // Standard logistic sigmoid
    return 1 / (1 + Math.exp(-exponent));
}
