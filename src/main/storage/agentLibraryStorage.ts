import * as fs from 'fs';
import { join } from 'path';

export interface StorageResult {
    success: boolean;
    path?: string;
    error?: string;
}

export function saveAgentToLibrary(baseDir: string, agentData: Record<string, unknown>): StorageResult {
    try {
        const libraryDir = join(baseDir, 'library', 'agents');

        if (!fs.existsSync(libraryDir)) {
            fs.mkdirSync(libraryDir, { recursive: true });
        }

        const rawId = typeof agentData.id === 'string' ? agentData.id : 'unknown';
        const safeId = rawId.replace(/[^a-z0-9-]/gi, '_');
        const filename = `agent_${safeId}.json`;
        const filePath = join(libraryDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(agentData, null, 2), 'utf8');
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

export function getAgentsFromLibrary(baseDir: string): Record<string, unknown>[] {
    try {
        const libraryDir = join(baseDir, 'library', 'agents');
        if (!fs.existsSync(libraryDir)) {
            return [];
        }

        const files = fs.readdirSync(libraryDir).filter(file => file.endsWith('.json'));
        const agents = files.map(file => {
            try {
                const content = fs.readFileSync(join(libraryDir, file), 'utf8');
                return JSON.parse(content);
            } catch {
                return null;
            }
        }).filter((agent): agent is Record<string, unknown> => agent !== null);

        agents.sort((a, b) => {
            const aTime = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
            const bTime = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
            return bTime - aTime;
        });

        return agents;
    } catch {
        return [];
    }
}

export function deleteAgentFromLibrary(baseDir: string, id: string): StorageResult {
    try {
        const libraryDir = join(baseDir, 'library', 'agents');
        const safeId = id.replace(/[^a-z0-9-]/gi, '_');
        const filename = `agent_${safeId}.json`;
        const filePath = join(libraryDir, filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
