import React from 'react'
import Dashboard from './components/Dashboard'

function App(): JSX.Element {
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
                <div style={{ fontWeight: 600, letterSpacing: '1px', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                    OPEN-ENDED EVOLUTION SIMULATOR <span style={{ opacity: 0.5 }}>// AGENCY DETECTOR</span>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ height: 'calc(100vh - 40px)' }}>
                <Dashboard />
            </div>
        </div>
    )
}

export default App
