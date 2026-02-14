import { LibraryEntry } from './agentLibrary';

export interface SummonAgentRequest {
    query: string;
    topK?: number;
    preferredAdapter?: 'python' | 'http' | 'cli' | 'native';
}

export interface SummonMatch {
    entry: LibraryEntry;
    score: number;
    rationale: string[];
    summonPlan: {
        adapterType: string;
        entrypoint: string;
        invocation: string;
    };
}

const tokenize = (value: string): string[] => (
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
);

const scoreOverlap = (queryTokens: string[], candidateTokens: string[]) => {
    if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
    const candidateSet = new Set(candidateTokens);
    const matches = queryTokens.filter(token => candidateSet.has(token));
    return matches.length / queryTokens.length;
};

const buildSummonPlan = (entry: LibraryEntry, useCase: string, preferredAdapter?: string): SummonMatch['summonPlan'] => {
    const adapters = entry.universalRepresentation?.adapters || [];
    const adapter = adapters.find(item => item.type === preferredAdapter) || adapters[0] || {
        type: 'native',
        runtime: 'simulator-engine',
        entrypoint: `library://${entry.id}`,
        invocationTemplate: `summon_agent(id="${entry.id}", use_case="__USE_CASE__")`
    };

    const invocation = adapter.invocationTemplate
        .replace(/__USE_CASE__/g, useCase)
        .replace(/__AGENT_CONFIG__/g, JSON.stringify({
            id: entry.id,
            scenario: entry.scenario,
            genome: entry.genome?.data ?? null,
            metrics: entry.metricsAtEmergence
        }, null, 2));

    return {
        adapterType: adapter.type,
        entrypoint: adapter.entrypoint,
        invocation
    };
};

export const rankAgentsForUseCase = (entries: LibraryEntry[], request: SummonAgentRequest): SummonMatch[] => {
    const queryTokens = tokenize(request.query);
    const topK = Math.max(1, Math.min(request.topK ?? 5, 20));

    const scored = entries.map(entry => {
        const representation = entry.universalRepresentation;
        const searchable = [
            entry.xenobiologistReport.name,
            entry.xenobiologistReport.specSheet,
            entry.scenario.name,
            ...(entry.xenobiologistReport.tags || []),
            ...(representation?.searchTokens || []),
            ...(representation?.intents || []),
            ...(representation?.capabilities || [])
        ];
        const searchableTokens = tokenize(searchable.join(' '));

        const overlapScore = scoreOverlap(queryTokens, searchableTokens);
        const agencyBias = Math.min(1, entry.metricsAtEmergence.A);
        const confidenceBias = Math.min(1, entry.alertDetails.confidence);

        const score = overlapScore * 0.7 + agencyBias * 0.2 + confidenceBias * 0.1;

        const rationale = [
            `query overlap ${(overlapScore * 100).toFixed(1)}%`,
            `agency ${(agencyBias * 100).toFixed(1)}%`,
            `confidence ${(confidenceBias * 100).toFixed(1)}%`
        ];

        return {
            entry,
            score,
            rationale,
            summonPlan: buildSummonPlan(entry, request.query, request.preferredAdapter)
        };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};
