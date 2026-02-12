import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Brain, Zap, MessageSquare } from 'lucide-react';

export const AIControlPanel: React.FC = () => {
    const { isAIControlled, toggleAIControl, aiReasoning, aiStatus, lastAiUpdate, triggerAI, aiError } = useSimulationStore();

    return (
        <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 600 }}>
                    <Brain size={20} style={{ color: 'var(--color-agency)' }} />
                    AI Researcher
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {isAIControlled ? 'Active' : 'Disabled'}
                    </span>
                    {/* Toggle Button */}
                    <button
                        onClick={toggleAIControl}
                        style={{
                            width: '48px',
                            height: '24px',
                            borderRadius: '12px',
                            backgroundColor: isAIControlled ? 'var(--color-agency)' : 'var(--color-border)',
                            position: 'relative',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            padding: 0
                        }}
                        title="Toggle AI Control"
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            position: 'absolute',
                            top: '4px',
                            left: isAIControlled ? 'calc(100% - 20px)' : '4px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                        }} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isAIControlled ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Status Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-secondary)', padding: '0 4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: aiStatus === 'thinking' ? '#F59E0B' : aiStatus === 'cooldown' ? '#10B981' : '#6B7280',
                                    boxShadow: aiStatus === 'thinking' ? '0 0 8px #F59E0B' : 'none',
                                    transition: 'all 0.3s ease'
                                }} />
                                <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                                    {aiStatus === 'thinking' ? 'ANALYZING...' : aiStatus === 'cooldown' ? 'ACTIVE' : 'IDLE'}
                                </span>
                            </div>
                            <div>
                                {lastAiUpdate ? `Updated: ${lastAiUpdate.toLocaleTimeString()}` : 'Waiting for first update...'}
                            </div>
                        </div>

                        {/* Reason Cloud */}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                            <MessageSquare size={16} style={{ color: 'var(--color-agency)', marginTop: '4px', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                                    Current Thought Process
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.5', color: 'var(--color-text-primary)' }}>
                                    {aiReasoning || "Initializing AI Control..."}
                                </p>
                            </div>
                        </div>

                        {/* Controls Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                <Zap size={12} />
                                <span>Controlling: Difficulty (U)</span>
                            </div>
                            <button
                                onClick={() => triggerAI()}
                                disabled={aiStatus === 'thinking'}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-border)',
                                    color: aiStatus === 'thinking' ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: aiStatus === 'thinking' ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    textTransform: 'uppercase',
                                    fontWeight: 600,
                                    letterSpacing: '0.5px'
                                }}
                                onMouseEnter={(e) => { if (aiStatus !== 'thinking') e.currentTarget.style.borderColor = 'var(--color-agency)' }}
                                onMouseLeave={(e) => { if (aiStatus !== 'thinking') e.currentTarget.style.borderColor = 'var(--color-border)' }}
                            >

                                Force Analysis
                            </button>
                        </div>

                        {/* Error Message */}
                        {aiError && (
                            <div style={{
                                padding: '8px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--color-danger)',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: 'var(--color-danger)',
                                marginTop: '4px'
                            }}>
                                <strong>Error:</strong> {aiError}
                            </div>
                        )}

                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-secondary)' }}>
                        <p style={{ margin: 0, fontSize: '0.875rem' }}>Enable AI Researcher to allow autonomous parameter optimization.</p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>Requires valid API configuration.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
