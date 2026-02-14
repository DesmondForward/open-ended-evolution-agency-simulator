import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';

type ErdosDashboardProblem = {
    id: string;
    title: string;
    description: string;
    status: 'in progress' | 'solved';
    timestamp: string;
    steps: string[];
    agents: Array<{ name: string; id: string }>;
    copy_action: string;
};

const panelStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const ErdosProblemsPanel: React.FC = () => {
    const getErdosProblemsForDashboard = useSimulationStore(state => state.getErdosProblemsForDashboard);
    const currentScenarioId = useSimulationStore(state => state.currentScenarioId);
    const generation = useSimulationStore(state => state.currentState.generation);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const problems = useMemo<ErdosDashboardProblem[]>(() => {
        if (currentScenarioId !== 'erdos') return [];
        return getErdosProblemsForDashboard();
    }, [currentScenarioId, generation, getErdosProblemsForDashboard]);

    const handleCopy = async (problem: ErdosDashboardProblem) => {
        try {
            await navigator.clipboard.writeText(problem.copy_action);
            setCopiedId(problem.id);
            window.setTimeout(() => setCopiedId(prev => (prev === problem.id ? null : prev)), 1200);
        } catch (error) {
            console.warn('Failed to copy markdown summary:', error);
        }
    };

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>Erdos Problem Dashboard</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{problems.length} problems</span>
            </div>

            <pre style={{ margin: 0, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px', fontSize: '0.75rem', maxHeight: '140px', overflow: 'auto', color: 'var(--color-text-secondary)' }}>
                {JSON.stringify(problems, null, 2)}
            </pre>

            {problems.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>[]</div>
            ) : (
                problems.map(problem => (
                    <div key={problem.id} style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '10px', display: 'grid', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ fontSize: '0.85rem' }}>{problem.title}</strong>
                            <span style={{ fontSize: '0.72rem', color: problem.status === 'solved' ? '#41d17d' : 'var(--color-text-secondary)' }}>{problem.status}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{problem.description}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Updated: {problem.timestamp}</div>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Steps</div>
                            {problem.steps.length ? (
                                <ol style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.76rem' }}>
                                    {problem.steps.map((step, index) => <li key={`${problem.id}-step-${index}`}>{step}</li>)}
                                </ol>
                            ) : (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No steps yet.</div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Contributors</div>
                            {problem.agents.length ? (
                                <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.76rem' }}>
                                    {problem.agents.map(agent => <li key={`${problem.id}-${agent.id}`}>{agent.name} ({agent.id})</li>)}
                                </ul>
                            ) : (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>No contributors listed.</div>
                            )}
                        </div>
                        <button
                            onClick={() => handleCopy(problem)}
                            style={{
                                justifySelf: 'start',
                                background: 'var(--color-primary)',
                                border: 'none',
                                color: 'var(--color-bg)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '0.75rem'
                            }}
                        >
                            {copiedId === problem.id ? 'Copied!' : 'Copy proof/disprove'}
                        </button>
                    </div>
                ))
            )}
        </div>
    );
};

export default ErdosProblemsPanel;
