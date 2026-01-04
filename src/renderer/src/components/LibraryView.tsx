import React, { useEffect, useState } from 'react';
import { SavedAgent } from '../simulation/types';

interface LibraryViewProps {
    onClose: () => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ onClose }) => {
    const [agents, setAgents] = useState<SavedAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState<SavedAgent | null>(null);

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

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this agent?")) {
            const win = window as any;
            if (win.api && win.api.deleteAgent) {
                await win.api.deleteAgent(id);
                setAgents(agents.filter(a => a.id !== id));
                if (selectedAgent?.id === id) setSelectedAgent(null);
            }
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(10, 10, 26, 0.95)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            color: 'var(--color-text-primary)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontFamily: '"Outfit", sans-serif', fontSize: '2rem' }}>
                    Universal Library of Agents
                </h1>
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
            </div>

            <div style={{ display: 'flex', gap: '24px', height: '100%', overflow: 'hidden' }}>
                {/* List Column */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '12px' }}>
                    {loading && <div>Loading Library...</div>}
                    {!loading && agents.length === 0 && <div style={{ opacity: 0.7 }}>No agents discovered yet.</div>}

                    {agents.map(agent => (
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
                                <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-primary)' }}>{agent.name || "Unknown Agent"}</h3>
                                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Gen {agent.generation.toFixed(1)}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '8px', lineHeight: '1.4' }}>
                                {agent.description ? (agent.description.length > 80 ? agent.description.substring(0, 80) + '...' : agent.description) : "No description."}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{
                                    background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88',
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                                }}>
                                    A: {agent.metrics.A.toFixed(3)}
                                </div>
                                {agent.tags && agent.tags.map((tag, i) => (
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
                    ))}
                </div>

                {/* Detail Column */}
                <div style={{ flex: 2, background: 'var(--color-bg)', padding: '24px', borderRadius: '12px', overflowY: 'auto', border: '1px solid var(--color-border)' }}>
                    {selectedAgent ? (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '16px' }}>
                                <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--color-primary)' }}>{selectedAgent.name}</h2>
                                <span style={{ opacity: 0.5 }}>ID: {selectedAgent.id.substring(0, 8)}...</span>
                            </div>

                            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
                                {selectedAgent.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                                <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px' }}>
                                    <h4 style={{ marginTop: 0 }}>Metrics Snapshot</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, opacity: 0.9 }}>
                                        <li>Agency: <strong>{selectedAgent.metrics.A.toFixed(4)}</strong></li>
                                        <li>Complexity: {selectedAgent.metrics.C.toFixed(4)}</li>
                                        <li>Diversity: {selectedAgent.metrics.D.toFixed(4)}</li>
                                        <li>Alert Rate: {selectedAgent.metrics.alertRate.toFixed(4)}</li>
                                    </ul>
                                </div>
                                <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px' }}>
                                    <h4 style={{ marginTop: 0 }}>Environment Context</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, opacity: 0.9 }}>
                                        <li>Difficulty (U): <strong>{selectedAgent.environmentalControl.U.toFixed(2)}</strong></li>
                                        <li>Generation: {selectedAgent.generation.toFixed(1)}</li>
                                        <li>Timestamp: {new Date(selectedAgent.timestamp).toLocaleString()}</li>
                                    </ul>
                                </div>
                            </div>

                            <h3>Simulation "DNA" (Parameters)</h3>
                            <div style={{
                                background: '#000', padding: '16px', borderRadius: '8px',
                                fontFamily: 'monospace', fontSize: '0.9rem', overflowX: 'auto',
                                border: '1px solid #333'
                            }}>
                                {JSON.stringify(selectedAgent.parameters, null, 2)}
                            </div>

                            <h3 style={{ marginTop: '32px' }}>Emergence History</h3>
                            <div style={{
                                background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}>
                                {selectedAgent.historySnippet && selectedAgent.historySnippet.map((h, i) => (
                                    <div key={i} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <span style={{ color: 'var(--color-primary)' }}>Gen {h.generation.toFixed(1)}</span>: {h.action} <br />
                                        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Reasoning: {h.reasoning}</span>
                                    </div>
                                ))}
                            </div>

                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                            Select an agent to view full details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LibraryView;
