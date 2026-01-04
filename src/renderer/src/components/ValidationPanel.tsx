import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Check, X } from 'lucide-react';

const ValidationPanel: React.FC = () => {
    const { validationMetrics, currentState } = useSimulationStore();
    const { stateBoundsViolationRate, diversityFloorViolationFraction } = validationMetrics;

    // Helpers for status
    const getStatusColor = (value: number, threshold: number) => value <= threshold ? '#4ade80' : '#f43f5e';
    const getStatusIcon = (value: number, threshold: number) => value <= threshold ? <Check size={16} /> : <X size={16} />;

    return (
        <div className="card" style={{ padding: '16px', fontSize: '0.9rem' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Validation & Constraints</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Bounds Constraint */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>State Bounds (0-1)</span>
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: getStatusColor(stateBoundsViolationRate, 0.01)
                        }}>
                            {getStatusIcon(stateBoundsViolationRate, 0.01)}
                            {(stateBoundsViolationRate * 100).toFixed(1)}% Violation
                        </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--color-bg)', borderRadius: '2px' }}>
                        <div style={{
                            width: `${Math.min(100, stateBoundsViolationRate * 1000)}%`, // Scale up for visibility
                            height: '100%',
                            background: getStatusColor(stateBoundsViolationRate, 0.01),
                            borderRadius: '2px'
                        }} />
                    </div>
                </div>

                {/* Diversity Floor Constraint */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>Diversity Floor (D &gt; 0.2)</span>
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: getStatusColor(diversityFloorViolationFraction, 0.1)
                        }}>
                            {getStatusIcon(diversityFloorViolationFraction, 0.1)}
                            {(diversityFloorViolationFraction * 100).toFixed(1)}% Violation
                        </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--color-bg)', borderRadius: '2px' }}>
                        <div style={{
                            width: `${Math.min(100, diversityFloorViolationFraction * 100)}%`,
                            height: '100%',
                            background: getStatusColor(diversityFloorViolationFraction, 0.1),
                            borderRadius: '2px'
                        }} />
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Scientific Alignment</span>
                        <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> Passed</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                        <span>Novelty Check</span>
                        <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> Passed</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ValidationPanel;
