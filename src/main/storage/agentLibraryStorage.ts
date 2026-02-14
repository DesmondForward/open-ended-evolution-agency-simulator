import * as fs from 'fs';
import { join } from 'path';
import {
    LibraryEntry,
    LibraryIndexEntry,
    normalizeAgentEntry,
    toLibraryIndexEntry
} from '../../shared/agentLibrary';

export interface StorageResult {
    success: boolean;
    path?: string;
    error?: string;
}

interface LibraryIndex {
    schemaVersion: '1.0.0';
    updatedAt: string;
    entries: LibraryIndexEntry[];
}

const INDEX_SCHEMA_VERSION: LibraryIndex['schemaVersion'] = '1.0.0';
const MAX_INLINE_TRACE_POINTS = 240;

const sanitizeId = (value: string) => value.replace(/[^a-z0-9-]/gi, '_');

const ensureLibraryDirs = (baseDir: string) => {
    const libraryDir = join(baseDir, 'library');
    const agentsDir = join(libraryDir, 'agents');
    const tracesDir = join(libraryDir, 'traces');
    const indexPath = join(libraryDir, 'index.json');

    if (!fs.existsSync(agentsDir)) {
        fs.mkdirSync(agentsDir, { recursive: true });
    }
    if (!fs.existsSync(tracesDir)) {
        fs.mkdirSync(tracesDir, { recursive: true });
    }

    return { libraryDir, agentsDir, tracesDir, indexPath };
};

const readIndex = (indexPath: string): LibraryIndex => {
    if (!fs.existsSync(indexPath)) {
        return { schemaVersion: INDEX_SCHEMA_VERSION, updatedAt: new Date().toISOString(), entries: [] };
    }
    try {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (data && Array.isArray(data.entries)) {
            return {
                schemaVersion: INDEX_SCHEMA_VERSION,
                updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
                entries: data.entries
            };
        }
    } catch {
        // fall through to default
    }
    return { schemaVersion: INDEX_SCHEMA_VERSION, updatedAt: new Date().toISOString(), entries: [] };
};

const writeIndex = (indexPath: string, index: LibraryIndex) => {
    const nextIndex: LibraryIndex = {
        ...index,
        schemaVersion: INDEX_SCHEMA_VERSION,
        updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(indexPath, JSON.stringify(nextIndex, null, 2), 'utf8');
};

const downsample = <T>(items: T[], maxPoints: number): T[] => {
    if (items.length <= maxPoints) return items;
    const stride = Math.ceil(items.length / maxPoints);
    const sampled: T[] = [];
    for (let i = 0; i < items.length; i += stride) {
        sampled.push(items[i]);
    }
    return sampled.slice(0, maxPoints);
};

const maybeDetachTrace = (entry: LibraryEntry, tracesDir: string, safeId: string): LibraryEntry => {
    const trace = entry.behaviorTrace?.samples;
    if (!trace || trace.length <= MAX_INLINE_TRACE_POINTS) {
        return entry;
    }

    const traceFile = join(tracesDir, `trace_${safeId}.json`);
    const traceBundle = {
        id: entry.id,
        createdAt: entry.createdAt,
        samples: trace
    };
    fs.writeFileSync(traceFile, JSON.stringify(traceBundle, null, 2), 'utf8');

    return {
        ...entry,
        behaviorTrace: {
            ...entry.behaviorTrace,
            samples: downsample(trace, MAX_INLINE_TRACE_POINTS),
            uri: `traces/trace_${safeId}.json`
        }
    };
};

export function saveAgentToLibrary(baseDir: string, agentData: Record<string, unknown>): StorageResult {
    try {
        const { agentsDir, tracesDir, indexPath } = ensureLibraryDirs(baseDir);
        const normalized = normalizeAgentEntry(agentData);
        if (!normalized.entry) {
            return { success: false, error: 'Invalid agent payload.' };
        }

        const entry = maybeDetachTrace(normalized.entry, tracesDir, sanitizeId(normalized.entry.id));
        const safeId = sanitizeId(entry.id);
        const filename = `agent_${safeId}.json`;
        const filePath = join(agentsDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');

        const index = readIndex(indexPath);
        const nextIndexEntry = toLibraryIndexEntry(entry);
        index.entries = index.entries.filter(existing => existing.id !== entry.id);
        index.entries.push(nextIndexEntry);
        index.entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        writeIndex(indexPath, index);

        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

export function getAgentsFromLibrary(baseDir: string): LibraryEntry[] {
    try {
        const { agentsDir, indexPath } = ensureLibraryDirs(baseDir);
        if (!fs.existsSync(agentsDir)) {
            return [];
        }

        const files = fs.readdirSync(agentsDir).filter(file => file.endsWith('.json'));
        const agents: LibraryEntry[] = [];
        let migratedAny = false;

        files.forEach(file => {
            const filePath = join(agentsDir, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(content);
                const normalized = normalizeAgentEntry(parsed);
                if (!normalized.entry) return;
                agents.push(normalized.entry);
                if (normalized.migrated) {
                    fs.writeFileSync(filePath, JSON.stringify(normalized.entry, null, 2), 'utf8');
                    migratedAny = true;
                }
            } catch {
                // Skip invalid files
            }
        });

        agents.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

        if (agents.length > 0 || migratedAny) {
            const nextIndex: LibraryIndex = {
                schemaVersion: INDEX_SCHEMA_VERSION,
                updatedAt: new Date().toISOString(),
                entries: agents.map(toLibraryIndexEntry)
            };
            writeIndex(indexPath, nextIndex);
        }

        return agents;
    } catch {
        return [];
    }
}

export function deleteAgentFromLibrary(baseDir: string, id: string): StorageResult {
    try {
        const { agentsDir, tracesDir, indexPath } = ensureLibraryDirs(baseDir);
        const safeId = sanitizeId(id);
        const filename = `agent_${safeId}.json`;
        const filePath = join(agentsDir, filename);
        const tracePath = join(tracesDir, `trace_${safeId}.json`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        } else {
            return { success: false, error: 'File not found' };
        }

        if (fs.existsSync(tracePath)) {
            fs.unlinkSync(tracePath);
        }

        const index = readIndex(indexPath);
        index.entries = index.entries.filter(entry => entry.id !== id);
        writeIndex(indexPath, index);

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
