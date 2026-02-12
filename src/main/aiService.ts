import { AiControlRequestPayload, AiControlResponsePayload, AiDescriptionRequestPayload, AiDescriptionResponsePayload } from '../shared/ipcValidation';

interface RawAIResponse {
    thought_process?: string;
    new_U?: number;
    parameter_updates?: Record<string, unknown>;
    config_updates?: Record<string, unknown>;
    name?: string;
    description?: string;
    tags?: string[];
    cognitive_horizon?: number;
    competency?: number;
}

const DEFAULT_MODEL = 'gpt-5.2-2025-12-11';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toNumber = (value: unknown, fallback = 0) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getApiKey = (): string | null => {
    return import.meta.env.VITE_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || null;
};

const getApiUrl = (): string => 'https://api.openai.com/v1/chat/completions';

const computeSdeDrift = (
    state: AiControlRequestPayload['state'],
    params: AiControlRequestPayload['currentParams'],
    control: AiControlRequestPayload['control']
) => {
    const C = toNumber(state.C);
    const D = toNumber(state.D);
    const A = toNumber(state.A);

    const k_CD = toNumber(params.k_CD);
    const k_AC = toNumber(params.k_AC);
    const k_DU = toNumber(params.k_DU);
    const k_U = toNumber(params.k_U);
    const k_C_decay = toNumber(params.k_C_decay);
    const k_D_growth = toNumber(params.k_D_growth);
    const k_D_decay = toNumber(params.k_D_decay);
    const k_AU = toNumber(params.k_AU);
    const k_A_decay = toNumber(params.k_A_decay);
    const dt = toNumber(params.dt, 0.1);

    const U = toNumber(control.U);

    const dC = (k_CD * D * (1 - C) + k_U * U * (1 - C) - k_C_decay * C) * dt;
    const dD = (k_D_growth * (1 - D) - k_DU * U * D - k_D_decay * D * D) * dt;
    const dA = (k_AC * C * (1 - A) + k_AU * U * C * (1 - A) - k_A_decay * A) * dt;

    return { dC, dD, dA };
};

const readJsonContent = (data: any): string => {
    if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data?.message?.content) return data.message.content;
    return '';
};

export async function requestAiControl(payload: AiControlRequestPayload): Promise<AiControlResponsePayload | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('API Key is missing. Please configure VITE_AI_API_KEY in .env');
    }

    const { state, currentParams, control, scenarioMetadata, history = [], bestAgency = 0, bestControl } = payload;

    let systemPhysics = '';
    let objectiveContext = '';

    if (scenarioMetadata.type === 'sde') {
        const drift = computeSdeDrift(state, currentParams, control);
        const dt = toNumber(currentParams.dt, 0.1);
        const momentum = {
            dC: drift.dC / dt,
            dD: drift.dD / dt,
            dA: drift.dA / dt
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
    } else {
        systemPhysics = `System Physics (ETD Scenario): Agents decompose tasks into skills. U increases task volatility.`;
        objectiveContext = `Guide U to maximize Agency (A) without collapsing diversity.`;
    }

    const recentHistory = history.slice(-5);
    const avgU = recentHistory.length > 0
        ? recentHistory.reduce((sum, h) => sum + (typeof h.u === 'number' ? h.u : control.U), 0) / recentHistory.length
        : control.U;
    const recentParamChanges = recentHistory.filter(h => h.params).length;

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
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText}\nBody: ${errorText}`);
        }

        const data = await response.json();
        const contentStr = readJsonContent(data);
        const parsed: RawAIResponse = JSON.parse(contentStr);

        let newU = toNumber(parsed.new_U, control.U);
        newU = clamp01(newU);

        const updates = parsed.parameter_updates ?? parsed.config_updates;

        return {
            u: newU,
            reasoning: parsed.thought_process || 'Optimizing parameter U.',
            params: updates
        };
    } catch (error: any) {
        console.error('[AI Control] Request failed:', error);
        throw error; // Propagate error
    }
}

export async function requestAgentDescription(payload: AiDescriptionRequestPayload): Promise<AiDescriptionResponsePayload | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return {
            name: `Agent-${payload.agentData.id.substring(0, 6)}`,
            description: 'AI API Key missing. Auto-generated placeholder description.',
            tags: ['High-Agency', 'Manual'],
            cognitiveHorizon: 0,
            competency: 0
        };
    }

    const agentData = payload.agentData;
    const prompt = `
You are an "Xenobiologist" analyzing a newly emerged digital lifeform (Agent) through the lens of Michael Levin's "Kinds of Minds" framework.
The agent has just crossed the Agency Threshold (A > ${agentData.metrics.A.toFixed(2)}).

**Agent Data:**
- ID: ${agentData.id}
- Generation of Emergence: ${agentData.generation.toFixed(1)}
- Metrics at Emergence: ${JSON.stringify(agentData.metrics)}
- Environmental Conditions: U=${agentData.environmentalControl.U.toFixed(2)} (Difficulty)
- Parameters (DNA): ${JSON.stringify(agentData.parameters)}
- Run Context: Best Agency So Far=${agentData.runContext.bestAgencySoFar.toFixed(3)}
- Validation Status: Bounds Violation Rate=${(agentData.validationMetrics.stateBoundsViolationRate * 100).toFixed(1)}%, Diversity Floor Violations=${(agentData.validationMetrics.diversityFloorViolationFraction * 100).toFixed(1)}%

**History leading to emergence:**
${agentData.historySnippet.map(h => `- Gen ${Number((h as any).generation ?? 0).toFixed(1)}: ${(h as any).action ?? 'Action'} -> ${(h as any).outcome?.delta_A > 0 ? 'Agency rose' : 'Agency fell'}`).join('\n')}

**Analysis Task:**
1.  **Taxonomy**: Give this agent a creative, scientific name (e.g., "Cryo-Stasis Strategist").
2.  **Spec Sheet**: Write a 2-3 sentence description explaining *why* it emerged. Use Levin's terminology where appropriate (e.g., "expanded its cognitive light cone", "competency in navigating high U").
3.  **Tags**: Assign 3-5 tags (e.g., "High-Pressure", "Stable", "Burst-Agency").
4.  **Levin Metrics Estimation**:
    *   **Cognitive Light Cone (0.0 - 1.0)**: Estimate the spatial/temporal goal horizon. 0.1 = Immediate reactive; 0.9 = Long-term strategic.
    *   **Competency (0.0 - 1.0)**: Estimate its ability to reach goals despite perturbations.

Return JSON format:
{
  "name": "...",
  "description": "...",
  "tags": ["...", "..."],
  "cognitive_horizon": 0.5,
  "competency": 0.7
}
`;

    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        const content = readJsonContent(data);
        const parsed: RawAIResponse = JSON.parse(content);

        return {
            name: parsed.name || `Agent-${agentData.id.substring(0, 8)}`,
            description: parsed.description || 'No description provided.',
            tags: Array.isArray(parsed.tags) ? parsed.tags.filter(tag => typeof tag === 'string') : ['Unclassified'],
            cognitiveHorizon: toNumber(parsed.cognitive_horizon, 0),
            competency: toNumber(parsed.competency, 0)
        };
    } catch (error) {
        console.error('[AI Description] Request failed:', error);
        return {
            name: `Agent-${agentData.id.substring(0, 8)}`,
            description: 'Failed to generate AI description. See console for error.',
            tags: ['Error'],
            cognitiveHorizon: 0,
            competency: 0
        };
    }
}
