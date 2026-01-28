import React, { useState } from 'react';
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

type TabType = 'main' | 'logs';

const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('main');

    const {
        currentScenarioId,
        availableScenarios,
        scenarioMetadata,
        switchScenario
    } = useSimulationStore();

    const tabButtonStyle = (isActive: boolean) => ({
        background: isActive ? 'var(--color-primary)' : 'transparent',
        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
        color: isActive ? 'var(--color-bg)' : 'var(--color-text-secondary)',
        borderRadius: '4px',
        padding: '6px 16px',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.5px',
        transition: 'all 0.2s ease'
    });

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

            {/* Right Column: Controls & Info with Tabs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, overflowY: 'auto' }}>
                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                        onClick={() => setActiveTab('main')}
                        style={tabButtonStyle(activeTab === 'main')}
                    >
                        MAIN
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        style={tabButtonStyle(activeTab === 'logs')}
                    >
                        LOGS
                    </button>
                </div>

                {/* Main Tab Content */}
                {activeTab === 'main' && (
                    <>
                        <ControlPanel />
                        <AlertPanel />
                        <ParameterPanel />
                    </>
                )}

                {/* Logs Tab Content */}
                {activeTab === 'logs' && (
                    <>
                        <InterventionLogPanel />
                        <AgencyLog />
                        <ValidationPanel />
                    </>
                )}
            </div>

        </div>
    );
};

export default Dashboard;
