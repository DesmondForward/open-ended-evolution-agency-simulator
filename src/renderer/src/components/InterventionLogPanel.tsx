import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Activity } from 'lucide-react';

const InterventionLogPanel: React.FC = () => {
    const { interventionLog } = useSimulationStore();

    // Reverse log to show newest first
    const displayLog = [...interventionLog].reverse();

    return (
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', maxHeight: '300px', minHeight: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} style={{ color: 'var(--color-primary)' }} />
                    Intervention Log
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {interventionLog.length} Events
                </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayLog.length === 0 ? (
                    <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No interventions recorded.
                    </div>
                ) : (
                    displayLog.map(entry => (
                        <div key={entry.id} style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '4px',
                            borderLeft: `2px solid ${entry.source === 'AI' ? 'var(--color-agency)' : 'var(--color-primary)'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 600, color: entry.source === 'AI' ? 'var(--color-agency)' : 'var(--color-primary)' }}>
                                    {entry.source}
                                </span>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                    Gen {entry.timestamp.toFixed(1)}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>{entry.action}</div>
                            {entry.reasoning && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                    "{entry.reasoning}"
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default InterventionLogPanel;
