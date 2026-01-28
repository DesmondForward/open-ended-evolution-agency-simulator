import React, { useEffect } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import MetricsChart from './MetricsChart';
import StateGauges from './StateGauges';
import ControlPanel from './ControlPanel';
import SimulationControls from './SimulationControls';
import AlertPanel from './AlertPanel';
import ParameterPanel from './ParameterPanel';
import ValidationPanel from './ValidationPanel';
import { AIControlPanel } from './AIControlPanel';
import InterventionLogPanel from './InterventionLogPanel';
import AgencyLog from './AgencyLog';

const Dashboard: React.FC = () => {
    const {
        currentScenarioId,
        availableScenarios,
        scenarioMetadata,
        switchScenario
    } = useSimulationStore();

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '16px', height: '100%', padding: '16px', boxSizing: 'border-box' }}>

            {/* Scenario Header */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>SCENARIO:</span>
                    <select
                        value={currentScenarioId}
                        onChange={(e) => switchScenario(e.target.value)}
                        style={{
                            background: 'var(--color-bg)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-primary-dim)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        {availableScenarios.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {scenarioMetadata.description}
                </div>
            </div>

            {/* Left Column: Visualization */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
                <StateGauges />
                <MetricsChart />
                <SimulationControls />
                <AIControlPanel />
            </div>

            {/* Right Column: Controls & Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, overflowY: 'auto' }}>
                <ControlPanel />
                <AlertPanel />
                <InterventionLogPanel />
                <AgencyLog />
                <ParameterPanel />
                <ValidationPanel />
            </div>

        </div>
    );
};

export default Dashboard;
