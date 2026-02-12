import { createSnapshot, normalizeScenarioId, parseSnapshot, SNAPSHOT_VERSION } from './snapshot';
import { DEFAULT_CONTROL, DEFAULT_INITIAL_STATE, DEFAULT_PARAMETERS } from './types';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

function runTests() {
    console.log('Starting Snapshot Tests...');

    // Scenario selection + clamping
    const raw = {
        meta: {
            version: '2.0.0',
            timestamp: Date.now(),
            scenarioId: 'unknown-scenario'
        },
        store: {
            parameters: { ...DEFAULT_PARAMETERS, k_CD: 0.2 },
            control: { U: 2.5 },
            bestAgency: 0.9,
            aiHistory: [],
            interventionLog: [],
            currentState: { ...DEFAULT_INITIAL_STATE, C: 1.5, D: -0.5, A: 0.7, alertRate: -2, generation: 10 },
            scenarioConfigs: {
                math: { populationSize: -5, mutationRate: 2, tasksPerGen: 0, difficultyScale: -1, noveltyThreshold: 2, verificationBudget: -10, enableTheorems: true }
            }
        },
        scenarioData: '{}'
    };

    const parsed = parseSnapshot(JSON.stringify(raw));
    assert(parsed !== null, 'Parse legacy snapshot');
    assert(parsed!.meta.scenarioId === 'sde-v1', 'Scenario selection clamps to default');
    assert(parsed!.store.control.U === 1, 'Control U is clamped to [0,1]');
    assert(parsed!.store.currentState.C === 1, 'State C is clamped to [0,1]');
    assert(parsed!.store.currentState.D === 0, 'State D is clamped to [0,1]');

    // Export/Import roundtrip
    const snapshot = createSnapshot({
        meta: { version: SNAPSHOT_VERSION, timestamp: Date.now(), scenarioId: 'sde-v1' },
        store: {
            sdeParameters: { ...DEFAULT_PARAMETERS, k_CD: 0.15 },
            control: { ...DEFAULT_CONTROL },
            bestAgency: 0.42,
            aiHistory: [],
            interventionLog: [],
            currentState: { ...DEFAULT_INITIAL_STATE },
            scenarioConfigs: parsed!.store.scenarioConfigs
        },
        scenarioData: '{}'
    });

    const roundtrip = parseSnapshot(JSON.stringify(snapshot));
    assert(roundtrip !== null, 'Roundtrip snapshot parse');
    assert(roundtrip!.meta.version === SNAPSHOT_VERSION, 'Snapshot version preserved');
    assert(Math.abs(roundtrip!.store.sdeParameters.k_CD - 0.15) < 0.0001, 'Snapshot parameters preserved');

    // normalizeScenarioId
    assert(normalizeScenarioId('math') === 'math', 'Known scenario id preserved');
    assert(normalizeScenarioId('not-real') === 'sde-v1', 'Unknown scenario id normalized');

    console.log('All snapshot tests passed!');
}

runTests();
