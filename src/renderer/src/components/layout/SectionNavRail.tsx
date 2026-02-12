import React from 'react'
import { APP_SECTIONS, AppSectionId } from '../../navigation/appSections'

interface SectionNavRailProps {
  activeSectionId: AppSectionId
  onSelectSection: (id: AppSectionId) => void
}

const SectionNavRail: React.FC<SectionNavRailProps> = ({ activeSectionId, onSelectSection }) => {
  return (
    <aside
      style={{
        width: '260px',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '16px 12px',
        overflowY: 'auto'
      }}
    >
      <div style={{ marginBottom: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
        Workspace
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {APP_SECTIONS.map((section) => {
          const isActive = section.id === activeSectionId
          return (
            <button
              key={section.id}
              onClick={() => onSelectSection(section.id)}
              style={{
                textAlign: 'left',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: isActive ? 'rgba(0,255,136,0.12)' : 'transparent',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                color: 'var(--color-text-primary)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{section.label}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{section.shortcut}</span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.76rem', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                {section.description}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export default SectionNavRail
