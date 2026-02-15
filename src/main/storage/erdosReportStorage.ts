import * as fs from 'fs';
import { join } from 'path';

export interface ErdosReportPayload {
    problemId: string;
    erdosNumber?: number;
    title: string;
    markdown: string;
    datasetRevision: string;
    evaluatorStatus: 'verified' | 'refuted' | 'inconclusive';
    evaluatorArtifactId: string;
    evidenceReferences: string[];
}

export interface ErdosReportResult {
    success: boolean;
    path?: string;
    error?: string;
}

const sanitizeSegment = (value: string): string => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export function saveErdosReport(baseDir: string, payload: ErdosReportPayload): ErdosReportResult {
    try {
        if (!payload.markdown.trim()) {
            return { success: false, error: 'Markdown report is empty.' };
        }

        const reportsDir = join(baseDir, 'erdos-reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const numberPrefix = typeof payload.erdosNumber === 'number' && Number.isFinite(payload.erdosNumber)
            ? String(payload.erdosNumber).padStart(4, '0')
            : 'unlisted';
        const slug = sanitizeSegment(payload.problemId || payload.title) || 'problem';
        const filePath = join(reportsDir, `${numberPrefix}-${slug}.md`);
        const reportWithMetadata = [
            '---',
            `problemId: ${payload.problemId}`,
            `title: ${payload.title}`,
            `datasetRevision: ${payload.datasetRevision}`,
            `evaluatorStatus: ${payload.evaluatorStatus}`,
            `evaluatorArtifactId: ${payload.evaluatorArtifactId}`,
            `evidenceReferences: [${payload.evidenceReferences.map(reference => JSON.stringify(reference)).join(', ')}]`,
            '---',
            '',
            payload.markdown
        ].join('\n');
        fs.writeFileSync(filePath, reportWithMetadata, 'utf8');
        return { success: true, path: filePath };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to save Erdos report.' };
    }
}
