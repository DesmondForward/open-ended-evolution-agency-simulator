import React, { useState } from 'react'
import Dashboard from './components/Dashboard'
import LibraryView from './components/LibraryView'

function App(): JSX.Element {
    const [showLibrary, setShowLibrary] = useState(false);

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
                WebkitAppRegion: 'drag' as any // Semantic drag region for Electron
            }}>
                <div style={{ fontWeight: 600, letterSpacing: '1px', fontSize: '0.9rem', color: 'var(--color-text-primary)', flex: 1 }}>
                    OPEN-ENDED EVOLUTION SIMULATOR <span style={{ opacity: 0.5 }}>// AGENCY DETECTOR</span>
                </div>
                <button
                    onClick={() => setShowLibrary(true)}
                    style={{
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
            </div>

            {/* Main Content */}
            <div style={{ height: 'calc(100vh - 40px)', position: 'relative' }}>
                <Dashboard />
                {showLibrary && <LibraryView onClose={() => setShowLibrary(false)} />}
            </div>
        </div>
    )
}

export default App
