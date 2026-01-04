
import { SimulationState, SimulationParameters, ControlSignal, AIHistoryEntry } from '../simulation/types';
import { computeDrift } from '../simulation/sdeEngine';

interface AIResponse {
    thought_process: string;
    new_U: number;
    parameter_updates?: Partial<SimulationParameters>;
}

export const fetchAIControl = async (
    state: SimulationState,
    currentParams: SimulationParameters,
    control: ControlSignal,
    history: AIHistoryEntry[] = [],
    bestAgency: number = 0,
    bestParams: SimulationParameters | null = null,
    bestControl: ControlSignal | null = null
): Promise<{ u: number; reasoning: string; params?: Partial<SimulationParameters> } | null> => {
    const apiKey = import.meta.env.VITE_AI_API_KEY;
    // Force standard OpenAI endpoint to resolve configuration issues
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    // const apiUrl = import.meta.env.VITE_AI_API_URL || 'https://api.openai.com/v1/chat/completions';

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        console.warn("AI API Key not set.");
        return null;
    }

    // --- Recent Strategy Analysis ---
    const recentHistory = history.slice(-5);
    const avgU = recentHistory.length > 0
        ? recentHistory.reduce((sum, h) => sum + (h.u !== undefined ? h.u : control.U), 0) / recentHistory.length
        : control.U;

    const recentParamChanges = recentHistory.filter(h => h.params).length;

    // --- Physics/Momentum Analysis ---
    const drift = computeDrift(state, currentParams, control);
    const momentum = {
        dC: drift.dC / currentParams.dt, // Normalized per generation
        dD: drift.dD / currentParams.dt,
        dA: drift.dA / currentParams.dt
    };

    const prompt = `
You are a "Hyper-Intelligent Researcher" overseeing an Open-Ended Evolutionary Simulation.
Your goal is to Maximize "Agency" (A) in the system and ensure interesting, complex behavior emerges.
CRITICAL OBJECTIVE: You must get Agency (A) to cross the 0.75 threshold. Take calculated risks to achieve this.

System Physics (Equations you can influence):
- dC/dt = k_CD*D*(1-C) + k_U*U*(1-C) - k_C_decay*C  (Complexity growth vs decay)
- dD/dt = k_D_growth*(1-D) - k_DU*U*D - k_D_decay*D^2    (Diversity growth vs selection pressure)
- dA/dt = k_AC*C*(1-A) + k_AU*U*C*(1-A) - k_A_decay*A (Agency emergence vs decay)

Current System State:
- Generation: ${state.generation.toFixed(1)}
- Complexity (C): ${state.C.toFixed(4)}
- Diversity (D): ${state.D.toFixed(4)}
- Agency (A): ${state.A.toFixed(4)}
- Alert Rate: ${state.alertRate.toFixed(4)}
- Current U: ${control.U.toFixed(2)}

Current System Momentum (Derivatives):
- dC/dt: ${momentum.dC.toFixed(4)} (${momentum.dC > 0 ? "Growing" : "Decaying"})
- dD/dt: ${momentum.dD.toFixed(4)} (${momentum.dD > 0 ? "Increasing" : "Collapsing"})
- dA/dt: ${momentum.dA.toFixed(4)} (${momentum.dA > 0 ? "Emerging" : "Fading"})

Best Agency Record (Target to Beat):
- Best Agency: ${bestAgency.toFixed(4)}
- Associated U: ${bestControl ? bestControl.U.toFixed(2) : 'N/A'}
- Associated Params: ${bestParams ? JSON.stringify(bestParams) : 'N/A'}

Recent Strategy Analysis (Last 5 Steps):
- Average U: ${avgU.toFixed(2)}
- Parameter Adjustments made: ${recentParamChanges} times.
- VS Best Record: Current U is ${Math.abs(control.U - (bestControl?.U || 0)).toFixed(2)} away from best.

Current Parameter values (you can tune all of these):
- k_CD (Diversity->Complexity, 0-0.5): ${currentParams.k_CD.toFixed(3)}
- k_AC (Complexity->Agency, 0-0.5): ${currentParams.k_AC.toFixed(3)}
- k_DU (Control->Diversity Decay, 0-1.0): ${currentParams.k_DU.toFixed(3)}
- k_U (Control->Stimulation, 0-0.5): ${currentParams.k_U.toFixed(3)}
- k_C_decay (Complexity Decay, 0.1-0.5): ${currentParams.k_C_decay.toFixed(3)}
- k_D_growth (Diversity Growth, 0.1-0.5): ${currentParams.k_D_growth.toFixed(3)}
- k_D_decay (Diversity Decay, 0.1-0.5): ${currentParams.k_D_decay.toFixed(3)}
- k_AU (Agency Stimulation, 0-1.0): ${currentParams.k_AU.toFixed(3)}
- k_A_decay (Agency Decay, 0.1-0.5): ${currentParams.k_A_decay.toFixed(3)}
- sigma_C (Noise C, 0-0.2): ${currentParams.sigma_C.toFixed(3)}
- sigma_D (Noise D, 0-0.2): ${currentParams.sigma_D.toFixed(3)}
- sigma_A (Noise A, 0-0.2): ${currentParams.sigma_A.toFixed(3)}
- A_alert (Threshold, 0.1-0.9): ${currentParams.A_alert.toFixed(2)}


History (Your last actions and their impact):
${history.length > 0 ? history.map(h => `- Gen ${h.generation.toFixed(1)}: ${h.action} -> ${h.outcome.delta_A > 0 ? 'Improved A' : 'Decreased A'} by ${h.outcome.delta_A.toFixed(4)}`).join('\n') : "(No history yet)"}

Rules:
1. Compare your Recent Strategy to the Best Record. If your recent AVG U or Params are very different from the Best Record and Agency is lower, CONSIDER REVERTING towards the Best Record.
2. If the last 5 adjustments have not improved Agency, try a "Phase Shift" strategy (e.g. drop U low to rebuild diversity, then spike U high).
3. If Diversity (D) is dangerously low (<0.25), REDUCE U or DECREASE k_DU to reduce pressure. Do not increase k_DU.
4. If Agency (A) is rising, you might increase U to challenge it, or fine-tune k_AC/k_AU to reward complexity more.
5. Use 'parameter_updates' to experiment with SDE physics. E.g., slightly lower k_A_decay can help sustain Agency. Higher k_AU makes Difficulty imply more Agency.
6. Think Multi-Step: Don't just react to the immediate generation. Try to set up a trajectory (e.g. "Growth Phase" -> "Challenge Phase").

Return a JSON object with:
- "thought_process": A brief 1-sentence reasoning, citing history if relevant.
- "new_U": The new value for U (0.0 - 1.0).
- "parameter_updates": (Optional) A dictionary of SDE parameters to change (e.g., {"k_CD": 0.15}). Keys must match the list above.
`;


    try {
        console.log(`[AI Spec] Starting AI Control Request... Current U: ${control.U.toFixed(2)}, A: ${state.A.toFixed(4)}`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-5.2-2025-12-11',
                messages: [
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        console.log(`[AI Spec] Request sent to ${apiUrl}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText}\nBody: ${errorText}`);
        }

        const data = await response.json();

        let contentStr = '';

        if (data.choices && data.choices[0] && data.choices[0].message) {
            contentStr = data.choices[0].message.content;
        } else if (data.message && data.message.content) {
            // Fallback for some proxies
            contentStr = data.message.content;
        }

        const result: AIResponse = JSON.parse(contentStr);

        let newU = parseFloat(result.new_U as any);
        if (isNaN(newU)) newU = control.U;
        newU = Math.max(0, Math.min(1, newU));

        console.log(`[AI Spec] Success! New U: ${newU.toFixed(2)}. Reasoning: ${result.thought_process}`);
        if (result.parameter_updates) {
            console.log(`[AI Spec] Parameter Updates:`, result.parameter_updates);
        }

        return {
            u: newU,
            reasoning: result.thought_process || "Optimizing parameter U.",
            params: result.parameter_updates
        };

    } catch (error) {
        console.error("AI Control Failed:", error);
        return null;
    }
};
