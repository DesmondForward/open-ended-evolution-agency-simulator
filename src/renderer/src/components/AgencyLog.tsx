
import React from 'react';
import { useSimulationStore } from '../store/simulationStore';

const AgencyLog: React.FC = () => {
    const events = useSimulationStore(state => state.events);

    // Filter relevant events?
    // For now show all, usually they are threshold crossings or task solves.
    const logs = [...events].reverse();

    return (
        <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '300px',
            overflowY: 'auto'
        }}>
            <div style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                letterSpacing: '1px',
                marginBottom: '4px'
            }}>
                AGENCY LOG
            </div>

            {logs.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
                    No significant events recorded.
                </div>
            )}

            {logs.map((e, idx) => (
                <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    padding: '8px',
                    background: 'var(--color-bg)',
                    borderRadius: '4px',
                    borderLeft: `3px solid ${getColorForType(e.type)}`
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatType(e.type)}</span>
                        <span style={{ color: 'var(--color-text-dim)' }}>Gen {e.timestamp.toFixed(1)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {e.message}
                    </div>
                    {e.data && Object.keys(e.data).length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', fontFamily: 'monospace', marginTop: '4px' }}>
                            {JSON.stringify(e.data)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const getColorForType = (type: string) => {
    switch (type) {
        case 'threshold_crossed': return 'var(--color-primary)';
        case 'task_solved': return '#4ade80'; // Green
        case 'extinction': return '#ef4444'; // Red
        case 'custom': return '#a855f7'; // Purple
        default: return 'var(--color-border)';
    }
};

const formatType = (type: string) => {
    return type.toUpperCase().replace('_', ' ');
};

export default AgencyLog;
