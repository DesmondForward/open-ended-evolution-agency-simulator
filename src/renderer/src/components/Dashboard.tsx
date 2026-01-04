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

const Dashboard: React.FC = () => {
    const { isPlaying, step } = useSimulationStore();

    // Animation Loop
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = 0;
        const targetFPS = 60;
        const frameInterval = 1000 / targetFPS;

        const loop = (timestamp: number) => {
            if (!isPlaying) return;

            const deltaTime = timestamp - lastTime;

            if (deltaTime >= frameInterval) {
                step();
                lastTime = timestamp - (deltaTime % frameInterval);
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(loop);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, step]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '16px', height: '100%', padding: '16px', boxSizing: 'border-box' }}>

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
                <ParameterPanel />
                <ValidationPanel />
            </div>

        </div>
    );
};

export default Dashboard;
