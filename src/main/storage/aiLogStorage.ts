import * as fs from 'fs';
import { join } from 'path';
import { AiLogPayload } from '../../shared/ipcValidation';

export interface AiLogResult {
    success: boolean;
    path?: string;
    error?: string;
}

const LOG_HEADER = 'Timestamp,Generation,Action,U,Parameters,Reasoning,Agency,BestAgency\n';

export function appendAiLogEntry(baseDir: string, data: AiLogPayload): AiLogResult {
    try {
        const logsDir = join(baseDir, 'logs');
        const logFile = join(logsDir, 'ai_log.csv');

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        if (!fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, LOG_HEADER, 'utf8');
        }

        const timestamp = new Date().toISOString();
        const safeReasoning = `"${(data.reasoning || '').replace(/"/g, '""')}"`;
        const safeAction = `"${(data.action || '').replace(/"/g, '""')}"`;
        const safeParams = `"${JSON.stringify(data.params || {}).replace(/"/g, '""')}"`;

        const row = `${timestamp},${data.generation},${safeAction},${data.u},${safeParams},${safeReasoning},${data.agency},${data.bestAgency}\n`;
        fs.appendFileSync(logFile, row, 'utf8');
        return { success: true, path: logFile };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
