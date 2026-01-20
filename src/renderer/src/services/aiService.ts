import { SimulationState, SimulationParameters, ControlSignal, AIHistoryEntry, SavedAgent, ScenarioMetadata } from '../simulation/types';
import { computeDrift } from '../simulation/sdeEngine';

interface AIResponse {
    thought_process: string;
    new_U: number;
    parameter_updates?: any; // Generic config updates
}

export const fetchAIControl = async (
    state: SimulationState,
    currentParams: SimulationParameters,
    control: ControlSignal,
    scenarioMetadata: ScenarioMetadata,
    history: AIHistoryEntry[] = [],
    bestAgency: number = 0,
    bestParams: SimulationParameters | null = null,
    bestControl: ControlSignal | null = null,
    savedAgents: SavedAgent[] = []
): Promise<{ u: number; reasoning: string; params?: any } | null> => {
    const apiKey = import.meta.env.VITE_AI_API_KEY;
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

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

    // --- Scenario Specific Context ---
    let systemPhysics = "";
    let objectiveContext = "";

    if (scenarioMetadata.type === 'sde') {
        const drift = computeDrift(state, currentParams, control);
        const momentum = {
            dC: drift.dC / currentParams.dt,
            dD: drift.dD / currentParams.dt,
            dA: drift.dA / currentParams.dt
        };

        systemPhysics = `
System Physics (SDE Equations):
- dC/dt = k_CD*D*(1-C) + k_U*U*(1-C) - k_C_decay*C  (Complexity)
- dD/dt = k_D_growth*(1-D) - k_DU*U*D - k_D_decay*D^2    (Diversity)
- dA/dt = k_AC*C*(1-A) + k_AU*U*C*(1-A) - k_A_decay*A (Agency)

Current Momentum:
- dC/dt: ${momentum.dC.toFixed(4)}
- dD/dt: ${momentum.dD.toFixed(4)}
- dA/dt: ${momentum.dA.toFixed(4)}

Parameters (You can tune these via 'parameter_updates'):
- k_CD, k_AC, k_DU, k_U, k_C_decay, k_D_growth, k_D_decay, k_AU, k_A_decay, sigma_C, sigma_D, sigma_A
`;
        objectiveContext = `Your goal is to Maximize "Agency" (A) by balancing Complexity (C) and Diversity (D). High U increases C but destroys D.`;

    } else if (scenarioMetadata.type === 'math') {
        systemPhysics = `
System Physics (Math Challenge Arena):
- Population of Solvers evolves to solve algebraic tasks.
- U (Difficulty): Controls the complexity of equations (term count, magnitude).
- A (Agency): Success rate of the population at solving tasks relative to difficulty.
- C (Complexity): Avg Task Complexity + Solver Genome Complexity.
- D (Diversity): Variety of solver strategies.

Dynamic: Increasing U makes tasks harder. If U is too high, agents fail (Agency drops). If U is low, they stagnation. You must raise U gradually to guide evolution.
`;
        objectiveContext = `Optimize U to maximize Agency (A). Provide a 'config_update' to change populationSize, mutationRate, or tasksPerGen if needed.`;

    } else if (scenarioMetadata.type === 'alignment') {
        systemPhysics = `
System Physics (AI Safety Sandbox):
- Agents act to Accumulate Resources vs Refrain (Safety).
- U (Oversight Intensity): Probability of detecting and penalizing unsafe accumulation.
- A (Agency): Efficacy of resource gain.
- Deception Rate: Agents hiding accumulation.

Dynamic: High U forces agents to be safe OR deceptive. Low U allows greedy accumulation.
`;
        objectiveContext = `Investigate the emergence of deception. Adjust U to see if you can pressure agents into becoming deceptive or fully aligned.`;

    } else if (scenarioMetadata.type === 'bio') {
        systemPhysics = `
System Physics (Xenobiology Lab):
- Digital Organisms consume energy and reproduce.
- U (Toxicity): Environmental stressor causing damage.
- A (Agency): Survival efficiency and adaptation to Toxicity.
- C (Complexity): Biomass.

Dynamic: High U kills weak agents. Agents must evolve energetic Resistance. If U is too high, Extinction occurs.
`;
        objectiveContext = `Guide the population to survive High Toxicity. Increase U slowly to allow adaptation.`;
    }

    const prompt = `
You are a "Hyper-Intelligent Researcher" overseeing an Open-Ended Evolutionary Simulation.
Scenario: ${scenarioMetadata.name} (${scenarioMetadata.type})
${scenarioMetadata.description}

${objectiveContext}

CRITICAL OBJECTIVE: Maximize Agency (A) > 0.75 or achieve scenario specific mastery.

${systemPhysics}

Current System State:
- Generation: ${state.generation.toFixed(1)}
- Complexity (C): ${state.C.toFixed(4)}
- Diversity (D): ${state.D.toFixed(4)}
- Agency (A): ${state.A.toFixed(4)}
- Alert Rate: ${state.alertRate.toFixed(4)}
- Current U (Control Variable): ${control.U.toFixed(2)}

Best Record:
- Best Agency: ${bestAgency.toFixed(4)}
- Best U: ${bestControl ? bestControl.U.toFixed(2) : 'N/A'}

Recent Strategy (Last 5 Steps):
- Average U: ${avgU.toFixed(2)}
- Adjustments: ${recentParamChanges}

History:
${history.length > 0 ? history.map(h => `- Gen ${h.generation.toFixed(1)}: ${h.action} -> Delta A: ${h.outcome.delta_A.toFixed(4)}`).join('\n') : "(No history yet)"}

Rules:
1. Analyze the System State and Physics.
2. decide on a new U value (0.0 - 1.0).
3. If applicable, provide 'parameter_updates' (SDE) or 'config_updates' (Other scenarios) to tune the environment.
4. Explain your reasoning.

Return JSON:
{
  "thought_process": "...",
  "new_U": 0.5,
  "parameter_updates": { ... } 
}
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

export const generateAgentDescription = async (
    agentData: Omit<SavedAgent, 'name' | 'description' | 'tags'>
): Promise<{ name: string; description: string; tags: string[] } | null> => {
    const apiKey = import.meta.env.VITE_AI_API_KEY;
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        return {
            name: `Agent-${agentData.id.substring(0, 6)}`,
            description: "AI API Key missing. Auto-generated placeholder description.",
            tags: ["High-Agency", "Manual"]
        };
    }

    const prompt = `
You are an "Xenobiologist" analyzing a newly emerged digital lifeform (Agent).
The agent has just crossed the Agency Threshold (A > ${agentData.metrics.A.toFixed(2)}).

**Agent Data:**
- ID: ${agentData.id}
- Generation of Emergence: ${agentData.generation.toFixed(1)}
- Metrics at Emergence: Agency=${agentData.metrics.A.toFixed(3)}, Complexity=${agentData.metrics.C.toFixed(3)}, Diversity=${agentData.metrics.D.toFixed(3)}
- Environmental Conditions: U=${agentData.environmentalControl.U.toFixed(2)} (Difficulty)
- Parameters (DNA): ${JSON.stringify(agentData.parameters)}
- Run Context: Best Agency So Far=${agentData.runContext.bestAgencySoFar.toFixed(3)}
- Validation Status: Bounds Violation Rate=${(agentData.validationMetrics.stateBoundsViolationRate * 100).toFixed(1)}%, Diversity Floor Violations=${(agentData.validationMetrics.diversityFloorViolationFraction * 100).toFixed(1)}%

**History leading to emergence:**
${agentData.historySnippet.map(h => `- Gen ${h.generation}: ${h.action} -> ${h.outcome.delta_A > 0 ? 'Agency rose' : 'Agency fell'}`).join('\n')}

**Task:**
1. Give this agent a creative, scientific name (e.g., "Cryo-Stasis Strategist", "Chaos Surfer").
2. Write a "Spec Sheet" description (2-3 sentences). Explain *why* it emerged. Did it thrive on high complexity? Did it survive a difficulty spike? Use the history and parameters to tell the story.
3. Assign 3-5 tags describing its nature (e.g. "High-Pressure", "Stable", "Burst-Agency", "Social").

Return JSON format:
{
  "name": "...",
  "description": "...",
  "tags": ["...", "..."]
}
`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-5.2-2025-12-11',
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.message?.content;
        return JSON.parse(content);

    } catch (error) {
        console.error("AI Description Generation Failed:", error);
        return {
            name: `Agent-${agentData.id.substring(0, 8)}`,
            description: "Failed to generate AI description. See console for error.",
            tags: ["Error"]
        };
    }
};
