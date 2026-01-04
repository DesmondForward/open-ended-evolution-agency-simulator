import React from 'react';
import { useSimulationStore } from '../store/simulationStore';

interface GaugeProps {
    label: string;
    value: number;
    color: string;
}

const Gauge: React.FC<GaugeProps> = ({ label, value, color }) => {
    // Clamped percentage
    const percentage = Math.min(100, Math.max(0, value * 100));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
                position: 'relative',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: `conic-gradient(${color} ${percentage}%, var(--color-surface-hover) ${percentage}%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(0,0,0,0.2)'
            }}>
                <div style={{
                    width: '85px',
                    height: '85px',
                    borderRadius: '50%',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value.toFixed(2)}</span>
                </div>
            </div>
            <span style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{label}</span>
        </div>
    );
};

const StateGauges: React.FC = () => {
    const { currentState } = useSimulationStore();

    return (
        <div className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <Gauge label="Complexity (C)" value={currentState.C} color="var(--color-complexity)" />
            <Gauge label="Diversity (D)" value={currentState.D} color="var(--color-diversity)" />
            <Gauge label="Agency (A)" value={currentState.A} color="var(--color-agency)" />
        </div>
    );
};

export default StateGauges;
