import React, { useEffect, useMemo, useState } from 'react'
import AppHeader from './components/layout/AppHeader'
import SectionNavRail from './components/layout/SectionNavRail'
import { APP_SECTIONS, AppSectionId, DEFAULT_SECTION_ID } from './navigation/appSections'
import { useSimulationStore } from './store/simulationStore'

function App(): JSX.Element {
  const [activeSectionId, setActiveSectionId] = useState<AppSectionId>(DEFAULT_SECTION_ID)

  const togglePlay = useSimulationStore((state) => state.togglePlay)
  const reset = useSimulationStore((state) => state.reset)
  const loadAgents = useSimulationStore((state) => state.loadAgents)

  const activeSection = useMemo(
    () => APP_SECTIONS.find((section) => section.id === activeSectionId) ?? APP_SECTIONS[0],
    [activeSectionId]
  )

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
      }

      if (event.code === 'KeyR' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        reset()
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'Digit1') {
        event.preventDefault()
        setActiveSectionId('dashboard')
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'Digit2') {
        event.preventDefault()
        setActiveSectionId('library')
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'Digit3') {
        event.preventDefault()
        setActiveSectionId('lattice')
      }

      if ((event.ctrlKey || event.metaKey) && event.code === 'Digit4') {
        event.preventDefault()
        setActiveSectionId('erdos')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [togglePlay, reset])

  return (
    <div className="app-container" style={{ height: '100vh', width: '100vw', background: 'var(--color-bg)' }}>
      <AppHeader activeLabel={activeSection.label} />
      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', minHeight: 0 }}>
        <SectionNavRail activeSectionId={activeSection.id} onSelectSection={setActiveSectionId} />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
          {activeSection.render(() => setActiveSectionId('dashboard'))}
        </main>
      </div>
    </div>
  )
}

export default App
