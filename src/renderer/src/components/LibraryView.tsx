import React, { useEffect, useMemo, useState } from 'react';
import { SavedAgent, SimulationParameters } from '../simulation/types';
import { LibraryEntry } from '../../../shared/agentLibrary';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { Eye } from 'lucide-react';
import AgentPreviewModal from './AgentPreviewModal';

interface LibraryViewProps {
    onClose: () => void;
    embedded?: boolean;
}

const LibraryView: React.FC<LibraryViewProps> = ({ onClose, embedded = false }) => {
    const [agents, setAgents] = useState<LibraryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState<LibraryEntry | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewAgent, setPreviewAgent] = useState<SavedAgent | null>(null);
    const [search, setSearch] = useState('');
    const [scenarioFilter, setScenarioFilter] = useState<string>('all');
    const [sortKey, setSortKey] = useState<'newest' | 'agency' | 'complexity' | 'diversity'>('newest');
    const [summonQuery, setSummonQuery] = useState('');
    const [summonOutput, setSummonOutput] = useState<string>('');

    useEffect(() => {
        const fetchAgents = async () => {
            const win = window as any;
            if (win.api && win.api.getAgents) {
                const data = await win.api.getAgents();
                setAgents(data);
            }
            setLoading(false);
        };
        fetchAgents();
    }, []);

    const getEntryMetrics = (entry: LibraryEntry) => entry.metricsAtEmergence;
    const getEntryName = (entry: LibraryEntry) => entry.xenobiologistReport?.name || 'Unknown Agent';
    const getEntryDescription = (entry: LibraryEntry) => entry.xenobiologistReport?.specSheet || 'No description.';
    const getEntryTags = (entry: LibraryEntry) => entry.xenobiologistReport?.tags || [];
    const getEntryScenarioLabel = (entry: LibraryEntry) => entry.scenario?.name || entry.scenario?.id || 'Unknown Scenario';

    const getSdeParameters = (entry: LibraryEntry): SimulationParameters | null => {
        if (entry.genome?.type === 'sde-params' && entry.genome.encoding === 'json') {
            return entry.genome.data as SimulationParameters;
        }
        const snapshot = entry.environmentSnapshot as any;
        const snapshotParams = snapshot?.parameters || snapshot?.scenarioConfig;
        if (snapshotParams && typeof snapshotParams === 'object') {
            return snapshotParams as SimulationParameters;
        }
        return null;
    };

    const toPreviewAgent = (entry: LibraryEntry): SavedAgent | null => {
        const params = getSdeParameters(entry);
        if (!params) return null;
        const metrics = getEntryMetrics(entry);
        return {
            id: entry.id,
            timestamp: entry.createdAt,
            name: getEntryName(entry),
            description: getEntryDescription(entry),
            tags: getEntryTags(entry),
            generation: metrics.generation,
            metrics: {
                A: metrics.A,
                C: metrics.C,
                D: metrics.D,
                alertRate: metrics.alertRate,
                cognitiveHorizon: metrics.cognitiveHorizon,
                competency: metrics.competency
            },
            parameters: params,
            environmentalControl: { U: metrics.U },
            historySnippet: [],
            validationMetrics: entry.validationMetrics || {
                stateBoundsViolationRate: 0,
                diversityFloorViolationFraction: 0,
                controlBoundsViolationRate: 0
            },
            runContext: {
                bestAgencySoFar: entry.runContext?.bestAgencySoFar ?? metrics.A
            }
        };
    };

    const filteredAgents = useMemo(() => {
        const query = search.trim().toLowerCase();
        let list = agents.filter(agent => {
            if (scenarioFilter !== 'all' && agent.scenario?.id !== scenarioFilter) return false;
            if (!query) return true;
            const blob = [
                getEntryName(agent),
                getEntryDescription(agent),
                getEntryScenarioLabel(agent),
                getEntryTags(agent).join(' '),
                agent.universalRepresentation?.intents?.join(' ') || '',
                agent.universalRepresentation?.capabilities?.join(' ') || ''
            ].join(' ').toLowerCase();
            return blob.includes(query);
        });

        list = list.sort((a, b) => {
            const aMetrics = getEntryMetrics(a);
            const bMetrics = getEntryMetrics(b);
            if (sortKey === 'agency') return bMetrics.A - aMetrics.A;
            if (sortKey === 'complexity') return bMetrics.C - aMetrics.C;
            if (sortKey === 'diversity') return bMetrics.D - aMetrics.D;
            return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        });

        return list;
    }, [agents, search, scenarioFilter, sortKey]);

    const scenarioOptions = useMemo(() => {
        const map = new Map<string, string>();
        agents.forEach(agent => {
            if (agent.scenario?.id) {
                map.set(agent.scenario.id, agent.scenario.name || agent.scenario.id);
            }
        });
        return Array.from(map.entries());
    }, [agents]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this agent?")) {
            const win = window as any;
            if (win.api && win.api.deleteAgent) {
                await win.api.deleteAgent(id);
                setAgents(agents.filter(a => a.id !== id));
                if (selectedAgent?.id === id) setSelectedAgent(null);
                if (previewAgent?.id === id) setPreviewAgent(null);
            }
        }
    };

    const generateEquation = (entry: LibraryEntry) => {
        const params = getSdeParameters(entry);
        if (!params) return '';
        const { k_AC = 0.5, k_AU = 0.5, k_A_decay = 0.35, sigma_A = 0.005 } = params;
        const U = getEntryMetrics(entry).U || 0;

        // Calculate the effective coefficient for the drift term
        // Growth = (k_AC * C + k_AU * U * C) * (1 - A)
        //        = (k_AC + k_AU * U) * C * (1 - A)
        const effectiveGrowthCoeff = (k_AC + k_AU * U).toFixed(4);
        const decayRate = Number(k_A_decay).toFixed(4);
        const sigma = Number(sigma_A).toFixed(3);

        // Generate LaTeX string
        // dA = \underbrace{ ( coeff * C * (1-A) - decay * A ) }_{\text{Deterministic Drift}} dt + \underbrace{ sigma }_{\text{Noise}} dW_A
        return `dA = \\underbrace{\\big( ${effectiveGrowthCoeff} \\, C \\, (1-A) - ${decayRate} \\, A \\big)}_{\\text{Deterministic Drift}} dt + \\underbrace{${sigma}}_{\\text{Noise}} dW_A`;
    };


    const runSummonSearch = async () => {
        const query = summonQuery.trim();
        if (!query) return;
        const win = window as any;
        if (win.api && win.api.summonAgent) {
            const result = await win.api.summonAgent({ query, topK: 1, preferredAdapter: 'python' });
            if (result?.success && result.data?.length > 0) {
                const match = result.data[0];
                setSummonOutput(`# Match: ${match.entry.xenobiologistReport.name}
Score: ${match.score.toFixed(3)}
Adapter: ${match.summonPlan.adapterType}

${match.summonPlan.invocation}`);
            } else {
                setSummonOutput('No compatible agent found for this use-case query.');
            }
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert("Equation copied to clipboard!");
        });
    };

    return (
        <div style={{
            position: embedded ? 'relative' : 'fixed',
            top: embedded ? undefined : 0,
            left: embedded ? undefined : 0,
            right: embedded ? undefined : 0,
            bottom: embedded ? undefined : 0,
            backgroundColor: 'rgba(10, 10, 26, 0.95)',
            zIndex: embedded ? 'auto' : 1000,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            color: 'var(--color-text-primary)',
            height: embedded ? '100%' : undefined,
            boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontFamily: '"Outfit", sans-serif', fontSize: '2rem' }}>
                    Universal Library of Agents
                </h1>
                {!embedded && (
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-primary)',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '1rem'
                        }}
                    >
                        Close
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '24px', height: '100%', overflow: 'hidden' }}>
                {/* List Column */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, tags, scenario..."
                            style={{
                                flex: '1 1 180px',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg)',
                                color: 'var(--color-text-primary)'
                            }}
                        />
                        <select
                            value={scenarioFilter}
                            onChange={(e) => setScenarioFilter(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg)',
                                color: 'var(--color-text-primary)'
                            }}
                        >
                            <option value="all">All Scenarios</option>
                            {scenarioOptions.map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as any)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg)',
                                color: 'var(--color-text-primary)'
                            }}
                        >
                            <option value="newest">Newest</option>
                            <option value="agency">Highest Agency</option>
                            <option value="complexity">Highest Complexity</option>
                            <option value="diversity">Highest Diversity</option>
                        </select>
                    </div>

                    {loading && <div>Loading Library...</div>}
                    {!loading && filteredAgents.length === 0 && <div style={{ opacity: 0.7 }}>No agents discovered yet.</div>}

                    {filteredAgents.map(agent => {
                        const metrics = getEntryMetrics(agent);
                        const tags = getEntryTags(agent);
                        return (
                            <div
                                key={agent.id}
                                onClick={() => setSelectedAgent(agent)}
                                style={{
                                    background: selectedAgent && selectedAgent.id === agent.id ? 'var(--color-primary-dim)' : 'var(--color-surface)',
                                    border: `1px solid ${selectedAgent && selectedAgent.id === agent.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                    padding: '16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary)' }}>{getEntryName(agent)}</h3>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Gen {metrics.generation.toFixed(1)}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', marginBottom: '8px', lineHeight: '1.4' }}>
                                    {getEntryDescription(agent).length > 80 ? `${getEntryDescription(agent).substring(0, 80)}...` : getEntryDescription(agent)}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <div style={{
                                        background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88',
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                                    }}>
                                        A: {metrics.A.toFixed(3)}
                                    </div>
                                    <div style={{
                                        background: 'rgba(0, 140, 255, 0.12)', color: '#7fb7ff',
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                                    }}>
                                        {getEntryScenarioLabel(agent)}
                                    </div>
                                    {tags.map((tag, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                                        }}>
                                            {tag}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={(e) => handleDelete(agent.id, e)}
                                        style={{
                                            background: 'transparent', border: 'none', color: '#ff4444',
                                            cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Detail Column */}
                <div style={{ flex: 2, background: 'var(--color-bg)', padding: '24px', borderRadius: '12px', overflowY: 'auto', border: '1px solid var(--color-border)' }}>
                    {selectedAgent ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '8px' }}>
                                <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--color-primary)' }}>{getEntryName(selectedAgent)}</h2>
                                <span style={{ opacity: 0.5 }}>ID: {selectedAgent.id.substring(0, 8)}...</span>
                            </div>
                            <div style={{ opacity: 0.6, marginBottom: '16px' }}>
                                {getEntryScenarioLabel(selectedAgent)} • v{selectedAgent.scenario?.version || 'unknown'} • {new Date(selectedAgent.createdAt).toLocaleString()}
                            </div>

                            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
                                {getEntryDescription(selectedAgent)}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                                <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px' }}>
                                    <h4 style={{ marginTop: 0 }}>Metrics Snapshot</h4>
                                    {(() => {
                                        const metrics = getEntryMetrics(selectedAgent);
                                        return (
                                            <ul style={{ listStyle: 'none', padding: 0, opacity: 0.9 }}>
                                                <li>Agency: <strong>{metrics.A.toFixed(4)}</strong></li>
                                                <li>Complexity: {metrics.C.toFixed(4)}</li>
                                                <li>Diversity: {metrics.D.toFixed(4)}</li>
                                                <li>Alert Rate: {metrics.alertRate.toFixed(4)}</li>
                                                {metrics.cognitiveHorizon !== undefined && (
                                                    <li>Cognitive Horizon: {metrics.cognitiveHorizon.toFixed(3)}</li>
                                                )}
                                                {metrics.competency !== undefined && (
                                                    <li>Competency: {metrics.competency.toFixed(3)}</li>
                                                )}
                                            </ul>
                                        );
                                    })()}
                                </div>
                                <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px' }}>
                                    <h4 style={{ marginTop: 0 }}>Environment Context</h4>
                                    {(() => {
                                        const metrics = getEntryMetrics(selectedAgent);
                                        return (
                                            <ul style={{ listStyle: 'none', padding: 0, opacity: 0.9 }}>
                                                <li>Difficulty (U): <strong>{metrics.U.toFixed(2)}</strong></li>
                                                <li>Generation: {metrics.generation.toFixed(1)}</li>
                                                <li>Trigger: {selectedAgent.alertDetails?.triggerType || 'threshold'}</li>
                                            </ul>
                                        );
                                    })()}
                                </div>
                            </div>

                            <h3>Genome / Parameters</h3>
                            <div style={{
                                background: '#000', padding: '16px', borderRadius: '8px',
                                fontFamily: 'monospace', fontSize: '0.9rem', overflowX: 'auto',
                                border: '1px solid #333', marginBottom: '32px'
                            }}>
                                {JSON.stringify(selectedAgent.genome?.data ?? selectedAgent.environmentSnapshot?.scenarioConfig ?? selectedAgent.environmentSnapshot?.parameters ?? {}, null, 2)}
                            </div>

                            {selectedAgent.universalRepresentation && (
                                <>
                                    <h3>Universal Agent Representation (UARM-1)</h3>
                                    <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
                                        <div style={{ marginBottom: '8px', opacity: 0.85 }}><strong>Capabilities:</strong> {selectedAgent.universalRepresentation.capabilities.join(' • ')}</div>
                                        <div style={{ marginBottom: '8px', opacity: 0.85 }}><strong>Intents:</strong> {selectedAgent.universalRepresentation.intents.slice(0, 6).join(', ')}</div>
                                        <div style={{ opacity: 0.85 }}><strong>Adapters:</strong> {selectedAgent.universalRepresentation.adapters.map(adapter => `${adapter.type}:${adapter.runtime}`).join(' • ')}</div>
                                    </div>

                                    <h4>Summon for Use-Case</h4>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <input
                                            value={summonQuery}
                                            onChange={(e) => setSummonQuery(e.target.value)}
                                            placeholder='e.g. "Need a safe high-agency planner for low-volatility tasks"'
                                            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                                        />
                                        <button
                                            onClick={runSummonSearch}
                                            style={{ background: 'var(--color-primary)', border: 'none', borderRadius: '6px', color: '#001015', cursor: 'pointer', fontWeight: 600, padding: '8px 14px' }}
                                        >
                                            Summon
                                        </button>
                                    </div>
                                    {summonOutput && (
                                        <pre style={{ whiteSpace: 'pre-wrap', background: '#05070f', border: '1px solid #263248', borderRadius: '8px', padding: '12px', marginTop: 0, marginBottom: '24px', fontSize: '0.8rem' }}>{summonOutput}</pre>
                                    )}
                                </>
                            )}

                            {getSdeParameters(selectedAgent) && (
                                <>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        Legacy Final Stochastic Form
                                        <button
                                            onClick={() => copyToClipboard(generateEquation(selectedAgent))}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: 'var(--color-text-secondary)',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                padding: '4px 8px',
                                                transition: 'background 0.2s',
                                            }}
                                            title="Copy equation to clipboard"
                                        >
                                            Copy LaTeX
                                        </button>
                                        <button
                                            onClick={() => {
                                                const preview = toPreviewAgent(selectedAgent);
                                                if (preview) {
                                                    setPreviewAgent(preview);
                                                    setShowPreview(true);
                                                }
                                            }}
                                            style={{
                                                background: 'rgba(0, 255, 136, 0.1)',
                                                border: '1px solid rgba(0, 255, 136, 0.3)',
                                                borderRadius: '4px',
                                                color: '#00ff88',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                padding: '4px 12px',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                            title="View 3D Dynamics"
                                        >
                                            <Eye size={14} />
                                            Preview Agent
                                        </button>
                                    </h3>
                                    <div style={{
                                        background: 'var(--color-surface)',
                                        padding: '24px',
                                        borderRadius: '8px',
                                        fontSize: '1.2rem',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        border: '1px solid var(--color-border)',
                                        minHeight: '80px'
                                    }}>
                                        <InlineMath math={generateEquation(selectedAgent)} />
                                    </div>
                                </>
                            )}

                            {selectedAgent.behaviorTrace?.summary && (
                                <>
                                    <h3 style={{ marginTop: '32px' }}>Behavior Trace</h3>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}>
                                        {selectedAgent.behaviorTrace.summary}
                                    </div>
                                </>
                            )}

                            {selectedAgent.researcherInterventions && selectedAgent.researcherInterventions.length > 0 && (
                                <>
                                    <h3 style={{ marginTop: '32px' }}>Researcher Interventions</h3>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px',
                                        fontSize: '0.9rem'
                                    }}>
                                        {selectedAgent.researcherInterventions.map((h: any, i: number) => (
                                            <div key={i} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                <span style={{ color: 'var(--color-primary)' }}>
                                                    Gen {Number(h.timestamp ?? h.generation ?? 0).toFixed(1)}
                                                </span>
                                                : {h.action || h.reasoning || 'Intervention logged'}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                            Select an agent to view full details
                        </div>
                    )}
                </div>
            </div>
            {showPreview && previewAgent && (
                <AgentPreviewModal
                    agent={previewAgent}
                    onClose={() => {
                        setShowPreview(false);
                        setPreviewAgent(null);
                    }}
                />
            )}
        </div>
    );
};

export default LibraryView;
