import React, { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { SimulationParameters } from '../simulation/types';

const ParameterPanel: React.FC = () => {
    const { parameters, updateParameters } = useSimulationStore();
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const handleChange = (key: keyof SimulationParameters, value: number) => {
        updateParameters({ [key]: value });
    };

    const ParamInput = ({ label, paramKey, min, max, step }: { label: string, paramKey: keyof SimulationParameters, min: number, max: number, step: number }) => (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span>{parameters[paramKey].toFixed(3)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={parameters[paramKey]}
                onChange={(e) => handleChange(paramKey, parseFloat(e.target.value))}
            />
        </div>
    );

    return (
        <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
                onClick={toggleOpen}
                style={{
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'var(--color-surface)',
                    borderBottom: isOpen ? '1px solid var(--color-border)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={18} />
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>SDE Parameters</h3>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {isOpen && (
                <div style={{ padding: '16px', background: 'var(--color-bg)', maxHeight: '400px', overflowY: 'auto' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Coupling Rates</h4>
                    <ParamInput label="Diversity → Complexity (k_CD)" paramKey="k_CD" min={0} max={0.5} step={0.01} />
                    <ParamInput label="Complexity → Agency (k_AC)" paramKey="k_AC" min={0} max={0.5} step={0.01} />
                    <ParamInput label="Control → Diversity Decay (k_DU)" paramKey="k_DU" min={0} max={1.0} step={0.01} />
                    <ParamInput label="Control → Stimulation (k_U)" paramKey="k_U" min={0} max={0.5} step={0.01} />

                    <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Stochasticity (Noise)</h4>
                    <ParamInput label="Sigma Complexity" paramKey="sigma_C" min={0} max={0.2} step={0.01} />
                    <ParamInput label="Sigma Diversity" paramKey="sigma_D" min={0} max={0.2} step={0.01} />
                    <ParamInput label="Sigma Agency" paramKey="sigma_A" min={0} max={0.2} step={0.01} />

                    <h4 style={{ margin: '16px 0 8px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Alert System</h4>
                    <ParamInput label="Threshold (A_alert)" paramKey="A_alert" min={0.1} max={0.9} step={0.05} />
                </div>
            )}
        </div>
    );
};

export default ParameterPanel;
