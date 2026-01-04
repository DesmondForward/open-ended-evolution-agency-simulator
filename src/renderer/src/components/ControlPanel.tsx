import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { AlertTriangle, Info } from 'lucide-react';

const ControlPanel: React.FC = () => {
    const { control, setControl, currentState, bestAgency, bestParameters, loadBestParameters } = useSimulationStore();

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setControl(parseFloat(e.target.value));
    };

    // Helper to determine difficulty description based on U value
    const getDifficultyLabel = (u: number) => {
        if (u < 0.3) return 'Safe / Boring';
        if (u < 0.6) return 'Stimulating';
        if (u < 0.8) return 'Challenging';
        return 'Hostile / Extinction Risk';
    };

    const getDifficultyColor = (u: number) => {
        if (u < 0.3) return '#4ade80'; // Green
        if (u < 0.6) return '#22d3ee'; // Cyan
        if (u < 0.8) return '#facc15'; // Yellow
        return '#f43f5e'; // Red
    };

    return (
        <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Intervention: Environment Difficulty (U)</h3>
                <Info size={16} color="var(--color-text-secondary)" style={{ cursor: 'help' }} title="Control external selection pressure to drive evolution" />
            </div>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: getDifficultyColor(control.U), fontWeight: 600 }}>
                        {getDifficultyLabel(control.U)}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        U = {control.U.toFixed(2)}
                    </span>
                </div>

                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={control.U}
                    onChange={handleSliderChange}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    <span>0.0 (Stagnant)</span>
                    <span>1.0 (Chaotic)</span>
                </div>
            </div>

            {currentState.D < 0.25 && control.U > 0.6 && (
                <div style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.9rem',
                    color: '#f43f5e'
                }}>
                    <AlertTriangle size={18} />
                    <span>Warning: High difficulty with low diversity risks collapse! Reduce U.</span>
                </div>
            )}

            {/* Persistence Controls */}
            {bestAgency > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Best Agency Record:</span>
                        <span style={{ fontWeight: 600, color: '#4ade80' }}>{bestAgency.toFixed(4)}</span>
                    </div>
                </div>
            )}
            {bestParameters && (
                <button
                    onClick={loadBestParameters}
                    style={{
                        width: '100%',
                        padding: '8px',
                        background: 'var(--color-surface-hover)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        transition: 'background 0.2s',
                        marginTop: '8px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-border)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                >
                    <span>↺ Restore Best Parameters</span>
                </button>
            )}

            {/* Open Logs Button */}
            <button
                onClick={() => {
                    const win = window as any;
                    if (win.api && win.api.openLogsFolder) {
                        win.api.openLogsFolder();
                    }
                }}
                style={{
                    width: '100%',
                    padding: '8px',
                    background: 'transparent',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    marginTop: '12px',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
            >
                <span>📂 Open AI Logs Folder</span>
            </button>
        </div>
    );
};

export default ControlPanel;
