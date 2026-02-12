import React from 'react'

interface AppHeaderProps {
  activeLabel: string
}

const AppHeader: React.FC<AppHeaderProps> = ({ activeLabel }) => {
  return (
    <header
      style={{
        height: '52px',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        // @ts-ignore
        WebkitAppRegion: 'drag' as any
      }}
    >
      <div style={{ fontWeight: 600, letterSpacing: '1px', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
        OPEN-ENDED EVOLUTION SIMULATOR <span style={{ opacity: 0.5 }}>// AGENCY DETECTOR</span>
      </div>
      <div
        style={{
          // @ts-ignore
          WebkitAppRegion: 'no-drag' as any,
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: '999px',
          padding: '4px 10px'
        }}
      >
        Active View: <strong style={{ color: 'var(--color-primary)' }}>{activeLabel}</strong>
      </div>
    </header>
  )
}

export default AppHeader
