import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import LibraryView from './components/LibraryView'
import { ConstraintLattice } from './components/visualizations/ConstraintLattice'
import { useSimulationStore } from './store/simulationStore'

function App(): JSX.Element {
    const [showLibrary, setShowLibrary] = useState(false);
    const [showLattice, setShowLattice] = useState(false);

    const togglePlay = useSimulationStore((state) => state.togglePlay);
    const reset = useSimulationStore((state) => state.reset);
    const loadAgents = useSimulationStore((state) => state.loadAgents);

    // Load agents on mount
    useEffect(() => {
        loadAgents();
    }, [loadAgents]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                event.preventDefault();
                togglePlay();
            }
            if (event.code === 'KeyR' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                reset();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [togglePlay, reset]);

    return (
        <div className="app-container" style={{ height: '100vh', width: '100vw', background: 'var(--color-bg)' }}>
            {/* Header/Title Bar */}
            <div style={{
                height: '40px',
                paddingTop: '0px',
                paddingLeft: '16px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                // @ts-ignore
                WebkitAppRegion: 'drag' as any // Semantic drag region for Electron
            }}>
                <div style={{ fontWeight: 600, letterSpacing: '1px', fontSize: '0.9rem', color: 'var(--color-text-primary)', flex: 1 }}>
                    OPEN-ENDED EVOLUTION SIMULATOR <span style={{ opacity: 0.5 }}>// AGENCY DETECTOR</span>
                </div>
                <button
                    onClick={() => setShowLibrary(true)}
                    style={{
                        // @ts-ignore
                        WebkitAppRegion: 'no-drag' as any,
                        background: 'transparent',
                        border: '1px solid var(--color-primary-dim)',
                        color: 'var(--color-primary)',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        marginRight: '16px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600
                    }}
                >
                    LIBRARY
                </button>
                <button
                    onClick={() => setShowLattice(true)}
                    style={{
                        // @ts-ignore
                        WebkitAppRegion: 'no-drag' as any,
                        background: 'transparent',
                        border: '1px solid var(--color-primary-dim)',
                        color: 'var(--color-primary)',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        marginRight: '16px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600
                    }}
                >
                    LATTICE
                </button>
            </div>

            {/* Main Content */}
            <div style={{ height: 'calc(100vh - 40px)', position: 'relative' }}>
                <Dashboard />
                <Dashboard />
                {showLibrary && <LibraryView onClose={() => setShowLibrary(false)} />}
                {showLattice && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0,0,0,0.95)',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ padding: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowLattice(false)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--color-text-secondary)',
                                    color: 'var(--color-text-secondary)',
                                    borderRadius: '4px',
                                    padding: '4px 12px',
                                    cursor: 'pointer'
                                }}
                            >
                                CLOSE
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <ConstraintLattice />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
