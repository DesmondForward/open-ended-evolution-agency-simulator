import * as os from 'os';
import * as fs from 'fs';
import { join } from 'path';
import { deleteAgentFromLibrary, getAgentsFromLibrary, saveAgentToLibrary } from './agentLibraryStorage';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

function runTests() {
    console.log('Starting Agent Library Storage Tests...');

    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'agentlib-'));
    const agent = {
        id: 'agent-test',
        timestamp: new Date().toISOString(),
        name: 'Test Agent',
        description: 'Unit test agent',
        tags: ['Test']
    };

    const saveResult = saveAgentToLibrary(tmpDir, agent);
    assert(saveResult.success, 'Agent saved to library');

    const listAfterSave = getAgentsFromLibrary(tmpDir);
    assert(listAfterSave.length === 1, 'Agent list contains saved agent');
    assert(listAfterSave[0].id === 'agent-test', 'Saved agent id matches');

    const deleteResult = deleteAgentFromLibrary(tmpDir, 'agent-test');
    assert(deleteResult.success, 'Agent deleted from library');

    const listAfterDelete = getAgentsFromLibrary(tmpDir);
    assert(listAfterDelete.length === 0, 'Agent list empty after delete');

    console.log('All agent library storage tests passed!');
}

runTests();
