import { requestAiControl, requestAgentDescription } from './aiService.ts';
import { AiControlRequestPayload, AiDescriptionRequestPayload } from '../shared/ipcValidation.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

type MockResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<any>;
    text: () => Promise<string>;
};

const mkResponse = (payload: any, ok = true, status = 200, statusText = 'OK'): MockResponse => ({
    ok,
    status,
    statusText,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
});

const controlPayload: AiControlRequestPayload = {
    state: { C: 0.4, D: 0.6, A: 0.5, alertRate: 0.1, generation: 4 },
    currentParams: {},
    control: { U: 0.3 },
    scenarioMetadata: {
        id: 'sde-v1',
        name: 'SDE',
        description: 'test',
        version: '1.0.0',
        type: 'sde'
    },
    history: []
};

const descriptionPayload: AiDescriptionRequestPayload = {
    agentData: {
        id: 'agent-test-1',
        timestamp: new Date().toISOString(),
        generation: 7,
        metrics: { A: 0.88, C: 0.31, D: 0.52, alertRate: 0.01 },
        parameters: {},
        environmentalControl: { U: 0.2 },
        historySnippet: [],
        validationMetrics: {
            stateBoundsViolationRate: 0,
            diversityFloorViolationFraction: 0,
            controlBoundsViolationRate: 0
        },
        runContext: { bestAgencySoFar: 0.9 }
    }
};

async function runTests() {
    process.env.OPENAI_API_KEY = 'test-key';

    const malformed = await requestAiControl(controlPayload, {
        fetchImpl: (async () => mkResponse({ output_text: '{bad-json' })) as any
    });
    assert(!malformed.ok && malformed.error.code === 'AI_RESPONSE_PARSE_ERROR', 'Malformed model output returns parse error');

    const missingField = await requestAiControl(controlPayload, {
        fetchImpl: (async () => mkResponse({ output_text: JSON.stringify({ u: 0.5 }) })) as any
    });
    assert(!missingField.ok && missingField.error.code === 'AI_SCHEMA_VALIDATION_ERROR', 'Missing required fields returns schema error');

    const outOfRange = await requestAgentDescription(descriptionPayload, {
        fetchImpl: (async () => mkResponse({
            output_text: JSON.stringify({
                name: 'x',
                description: 'desc',
                tags: ['a'],
                cognitiveHorizon: 1.4,
                competency: 0.8
            })
        })) as any
    });
    assert(!outOfRange.ok && outOfRange.error.code === 'AI_SCHEMA_VALIDATION_ERROR', 'Out-of-range values return schema error');

    let attempts = 0;
    const retried = await requestAiControl(controlPayload, {
        maxRetries: 1,
        fetchImpl: (async () => {
            attempts += 1;
            if (attempts === 1) {
                throw new Error('temporary network');
            }
            return mkResponse({ output_text: JSON.stringify({ u: 0.4, reasoning: 'steady', params: {} }) });
        }) as any
    });
    assert(retried.ok && attempts === 2, 'Retry policy retries once on transient network failure');

    let abortAttempts = 0;
    const aborted = await requestAiControl(controlPayload, {
        maxRetries: 1,
        fetchImpl: (async () => {
            abortAttempts += 1;
            const error = new Error('aborted');
            (error as any).name = 'AbortError';
            throw error;
        }) as any
    });
    assert(!aborted.ok && aborted.error.code === 'AI_ABORTED' && abortAttempts === 1, 'Abort policy does not retry aborted requests');

    console.log('All aiService tests passed.');
}

runTests();
