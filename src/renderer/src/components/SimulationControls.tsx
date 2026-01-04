import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';

const SimulationControls: React.FC = () => {
    const { isPlaying, togglePlay, reset, currentState } = useSimulationStore();

    return (
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    className={`btn ${isPlaying ? '' : 'btn-primary'}`}
                    onClick={togglePlay}
                    style={{ width: '100px', justifyContent: 'center' }}
                >
                    {isPlaying ? (
                        <>
                            <Pause size={18} /> Pause
                        </>
                    ) : (
                        <>
                            <Play size={18} /> Start
                        </>
                    )}
                </button>

                <button className="btn" onClick={reset}>
                    <RotateCcw size={18} /> Reset
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Current Generation</span>
                <span style={{ fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 600 }}>
                    {currentState.generation.toFixed(1)}
                </span>
            </div>
        </div>
    );
};

export default SimulationControls;
