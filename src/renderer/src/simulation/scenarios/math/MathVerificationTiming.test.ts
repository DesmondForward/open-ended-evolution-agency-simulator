import { MathScenario } from './MathScenario';
import { DEFAULT_MATH_CONFIG, MathClaim, MathExpression } from './MathTypes';
import { ControlSignal } from '../../types';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    console.log('Starting Math Verification Timing Tests...');

    const scenario = new MathScenario();
    scenario.initialize(42, {
        ...DEFAULT_MATH_CONFIG,
        populationSize: 1,
        tasksPerGen: 1,
        enableTheorems: true
    });

    const state = (scenario as any).state;
    const trivialExpr: MathExpression = {
        type: 'OP',
        op: 'EQ',
        left: { type: 'ATOM', value: 'x' },
        right: { type: 'ATOM', value: 'x' }
    };
    const claim: MathClaim = {
        id: 'claim-test',
        expression: trivialExpr,
        text: 'x = x',
        noveltyScore: 1,
        evidenceCount: 0,
        proven: false
    };
    state.claims = [claim];

    const control: ControlSignal = { U: 0.2 };
    scenario.step(control);
    const expectedGeneration = state.generation;

    await sleep(25);

    const events = scenario.getEvents();
    const proofEvent = events.find(event => event.type === 'task_solved');
    assert(!!proofEvent, 'Proof event emitted');
    assert(proofEvent!.timestamp === expectedGeneration, 'Proof event timestamp matches generation of request');

    console.log('All math verification timing tests passed!');
}

runTests();
