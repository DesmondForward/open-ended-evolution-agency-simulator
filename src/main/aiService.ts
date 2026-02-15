import {
    AiControlRequestPayload,
    AiControlResponsePayload,
    AiDescriptionRequestPayload,
    AiDescriptionResponsePayload,
    AiServiceErrorCode,
    AiServiceErrorPayload,
    AiServiceResult,
    validateAiControlResponsePayload,
    validateAiDescriptionResponsePayload
} from '../shared/ipcValidation';
import { aiControlResponseSchema, aiDescriptionResponseSchema, JsonSchema } from '../shared/schemas/aiResponseSchemas';

const DEFAULT_MODEL = 'gpt-5.2-2025-12-11';
const MAX_RETRIES = 1;

interface AiRequestOptions {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    maxRetries?: number;
}

const toNumber = (value: unknown, fallback = 0) => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getApiKey = (): string | null => {
    return import.meta.env.VITE_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || null;
};

const getApiUrl = (): string => 'https://api.openai.com/v1/responses';

const getScenarioGenerationDescriptor = (type: AiControlRequestPayload['scenarioMetadata']['type']): string => {
    if (type === 'sde') return 'continuous timestep';
    if (type === 'math') return 'training epoch';
    if (type === 'alignment') return 'oversight episode';
    if (type === 'bio') return 'evolutionary generation';
    if (type === 'agents') return 'task-cycle generation';
    return 'research round';
};

const getScenarioPhase = (
    type: AiControlRequestPayload['scenarioMetadata']['type'],
    generation: number
): 'bootstrap' | 'adaptive' | 'stabilization' => {
    const g = toNumber(generation);
    if (type === 'erdos') {
        if (g < 60) return 'bootstrap';
        if (g < 180) return 'adaptive';
        return 'stabilization';
    }
    if (type === 'alignment') {
        if (g < 80) return 'bootstrap';
        if (g < 220) return 'adaptive';
        return 'stabilization';
    }
    if (g < 120) return 'bootstrap';
    if (g < 320) return 'adaptive';
    return 'stabilization';
};

const makeError = (
    code: AiServiceErrorCode,
    message: string,
    retryable = false,
    details?: Record<string, unknown>
): AiServiceResult<never> => ({
    ok: false,
    error: { code, message, retryable, details }
});

const extractResponseText = (data: any): string => {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
        return data.output_text;
    }

    const output = Array.isArray(data?.output) ? data.output : [];
    for (const item of output) {
        const content = Array.isArray(item?.content) ? item.content : [];
        for (const part of content) {
            if (part?.type === 'output_text' && typeof part?.text === 'string' && part.text.trim()) {
                return part.text;
            }
        }
    }

    return '';
};

const callStructuredOutput = async <T>(
    apiKey: string,
    prompt: string,
    schemaName: string,
    schema: JsonSchema,
    validator: (value: unknown) => value is T,
    options: AiRequestOptions = {}
): Promise<AiServiceResult<T>> => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const maxRetries = options.maxRetries ?? MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            const response = await fetchImpl(getApiUrl(), {
                method: 'POST',
                signal: options.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    input: [{ role: 'user', content: prompt }],
                    text: {
                        format: {
                            type: 'json_schema',
                            name: schemaName,
                            strict: true,
                            schema
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                const retryable = response.status >= 500 || response.status === 429;
                if (retryable && attempt < maxRetries) {
                    continue;
                }
                return makeError('AI_API_ERROR', `API Error: ${response.status} ${response.statusText}`, retryable, {
                    status: response.status,
                    body: errorText
                });
            }

            const data = await response.json();
            const content = extractResponseText(data);
            if (!content) {
                return makeError('AI_RESPONSE_PARSE_ERROR', 'Structured output was empty.', false, {
                    responseId: data?.id
                });
            }

            let parsed: unknown;
            try {
                parsed = JSON.parse(content);
            } catch (error: any) {
                return makeError('AI_RESPONSE_PARSE_ERROR', 'Could not parse model JSON output.', false, {
                    cause: error?.message,
                    content
                });
            }

            if (!validator(parsed)) {
                return makeError('AI_SCHEMA_VALIDATION_ERROR', 'Model output failed schema validation.', false, {
                    payload: parsed
                });
            }

            return { ok: true, data: parsed };
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                return makeError('AI_ABORTED', 'AI request aborted.', false);
            }
            if (attempt < maxRetries) {
                continue;
            }
            return makeError('AI_NETWORK_ERROR', 'Network error while requesting AI.', true, {
                cause: error?.message ?? String(error)
            });
        }
    }

    return makeError('AI_NETWORK_ERROR', 'Retry policy exhausted.', true);
};

export async function requestAiControl(
    payload: AiControlRequestPayload,
    options: AiRequestOptions = {}
): Promise<AiServiceResult<AiControlResponsePayload>> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return makeError('AI_API_KEY_MISSING', 'API Key is missing. Configure VITE_AI_API_KEY or OPENAI_API_KEY.', false);
    }

    const { state, control, scenarioMetadata, history = [], bestAgency = 0, bestControl } = payload;
    const recentHistory = history.slice(-5);
    const avgU = recentHistory.length > 0
        ? recentHistory.reduce((sum, h) => sum + (typeof h.u === 'number' ? h.u : control.U), 0) / recentHistory.length
        : control.U;

    const generationUnit = getScenarioGenerationDescriptor(scenarioMetadata.type);
    const phase = getScenarioPhase(scenarioMetadata.type, state.generation);

    const prompt = `
You are a "Hyper-Intelligent Researcher" overseeing an Open-Ended Evolutionary Simulation.
Scenario: ${scenarioMetadata.name} (${scenarioMetadata.type})
${scenarioMetadata.description}

Current System State:
- Generation (${generationUnit}): ${state.generation.toFixed(1)}
- Phase: ${phase}
- Complexity (C): ${state.C.toFixed(4)}
- Diversity (D): ${state.D.toFixed(4)}
- Agency (A): ${state.A.toFixed(4)}
- Alert Rate: ${state.alertRate.toFixed(4)}
- Current U: ${control.U.toFixed(2)}
- Best Agency: ${bestAgency.toFixed(4)}
- Best U: ${bestControl ? bestControl.U.toFixed(2) : 'N/A'}
- Recent Avg U: ${avgU.toFixed(2)}

History:
${history.length > 0 ? history.map(h => `- Gen ${h.generation.toFixed(1)}: ${h.action} -> Delta A: ${h.outcome.delta_A.toFixed(4)}`).join('\n') : '(No history yet)'}

Return strict JSON with:
- u in [0, 1]
- reasoning (non-empty)
- optional params object
`;

    return callStructuredOutput(apiKey, prompt, 'ai_control_response', aiControlResponseSchema, validateAiControlResponsePayload, options);
}

export async function requestAgentDescription(
    payload: AiDescriptionRequestPayload,
    options: AiRequestOptions = {}
): Promise<AiServiceResult<AiDescriptionResponsePayload>> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return makeError('AI_API_KEY_MISSING', 'API Key is missing. Configure VITE_AI_API_KEY or OPENAI_API_KEY.', false);
    }

    const agentData = payload.agentData;
    const prompt = `
You are a "Xenobiologist" analyzing a newly emerged digital lifeform through Michael Levin's framework.

Agent Data:
- ID: ${agentData.id}
- Generation: ${agentData.generation.toFixed(1)}
- Metrics: ${JSON.stringify(agentData.metrics)}
- U: ${agentData.environmentalControl.U.toFixed(2)}
- Best Agency: ${agentData.runContext.bestAgencySoFar.toFixed(3)}

Return strict JSON with keys:
- name (non-empty)
- description (2-3 sentences)
- tags (3-5 strings)
- cognitiveHorizon in [0,1]
- competency in [0,1]
`;

    return callStructuredOutput(
        apiKey,
        prompt,
        'ai_description_response',
        aiDescriptionResponseSchema,
        validateAiDescriptionResponsePayload,
        options
    );
}

export const __testables = {
    extractResponseText,
    callStructuredOutput
};
