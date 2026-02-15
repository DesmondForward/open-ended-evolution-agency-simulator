import { AgentsScenario } from './scenarios/agents/AgentsScenario';
import { MathScenario } from './scenarios/math/MathScenario';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

function hashString(input: string): string {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function runMath(seed: number, steps: number): string {
    const scenario = new MathScenario();
    scenario.initialize(seed, { populationSize: 20, tasksPerGen: 8, enableTheorems: true });
    for (let i = 0; i < steps; i++) {
        scenario.step({ U: 0.35 });
    }
    return hashString(scenario.serialize());
}

function runAgents(seed: number, steps: number): string {
    const scenario = new AgentsScenario();
    scenario.initialize(seed, { populationSize: 30, tasksPerGen: 6, driftRate: 0.2, baseTaskDifficulty: 10 });
    for (let i = 0; i < steps; i++) {
        scenario.step({ U: 0.4 });
    }
    return hashString(scenario.serialize());
}

function run() {
    const mathA = runMath(1337, 30);
    const mathB = runMath(1337, 30);
    assert(mathA === mathB, 'MathScenario deterministic hash is stable for same seed/config/steps');

    const agentsA = runAgents(2024, 40);
    const agentsB = runAgents(2024, 40);
    assert(agentsA === agentsB, 'AgentsScenario deterministic hash is stable for same seed/config/steps');

    const mathDifferentSeed = runMath(1338, 30);
    assert(mathA !== mathDifferentSeed, 'MathScenario hash changes when seed changes');

    console.log('Determinism regression tests passed.');
}

run();
