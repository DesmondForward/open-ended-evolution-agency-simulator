
import { validateAiControlRequestPayload } from '../src/shared/ipcValidation';
import { DEFAULT_INITIAL_STATE, DEFAULT_PARAMETERS, DEFAULT_CONTROL } from '../src/renderer/src/simulation/types';

// Mock the SDE Scenario metadata as found in SDEScenario.ts
const mockScenarioMetadata = {
    id: 'sde-v1',
    name: 'SDE Macro-Dynamics (v1)',
    description: 'Original stochastic differential equation model for Complexity, Diversity, and Agency.',
    version: '1.0.0',
    title: 'SDE Simulation', // Extra field
    type: 'sde'
};

const mockPayload = {
    state: DEFAULT_INITIAL_STATE,
    currentParams: DEFAULT_PARAMETERS,
    control: DEFAULT_CONTROL,
    scenarioMetadata: mockScenarioMetadata,
    history: [],
    bestAgency: 0,
    bestControl: null
};

console.log('Testing payload validation...');
const result = validateAiControlRequestPayload(mockPayload);
console.log('Validation successful:', result);

if (!result) {
    console.error('Validation failed!');
    // Try to pinpoint why
    const value = mockPayload as any;
    const isRecord = (v: any) => typeof v === 'object' && v !== null && !Array.isArray(v);
    const isFiniteNumber = (v: any) => typeof v === 'number' && Number.isFinite(v);

    if (!isRecord(value)) console.log('value is not record');
    if (!isRecord(value.state)) console.log('state is not record');
    if (!isRecord(value.control)) console.log('control is not record');
    if (!isRecord(value.scenarioMetadata)) console.log('scenarioMetadata is not record');

    // Check deep properties
    if (!isFiniteNumber(value.state.C)) console.log('state.C invalid', value.state.C);
    if (!isFiniteNumber(value.state.D)) console.log('state.D invalid', value.state.D);
    if (!isFiniteNumber(value.state.A)) console.log('state.A invalid', value.state.A);
    if (!isFiniteNumber(value.state.alertRate)) console.log('state.alertRate invalid', value.state.alertRate);
    if (!isFiniteNumber(value.state.generation)) console.log('state.generation invalid', value.state.generation);

    if (!isFiniteNumber(value.control.U)) console.log('control.U invalid', value.control.U);

    if (typeof value.scenarioMetadata.id !== 'string') console.log('metadata.id invalid');
    if (typeof value.scenarioMetadata.name !== 'string') console.log('metadata.name invalid');
    // ... check others
}
