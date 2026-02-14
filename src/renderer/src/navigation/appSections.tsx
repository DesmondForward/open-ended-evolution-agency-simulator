import React from 'react'
import Dashboard from '../components/Dashboard'
import LibraryView from '../components/LibraryView'
import ErdosProblemsPanel from '../components/ErdosProblemsPanel'
import { ConstraintLattice } from '../components/visualizations/ConstraintLattice'

export type AppSectionId = 'dashboard' | 'library' | 'lattice' | 'erdos'

export interface AppSectionConfig {
  id: AppSectionId
  label: string
  description: string
  shortcut: string
  render: (onCloseSection: () => void) => React.ReactNode
}

export const APP_SECTIONS: AppSectionConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Primary simulation, controls, and runtime telemetry.',
    shortcut: '⌘/Ctrl+1',
    render: () => <Dashboard />
  },
  {
    id: 'library',
    label: 'Agent Library',
    description: 'Browse saved agents and inspect trajectories.',
    shortcut: '⌘/Ctrl+2',
    render: (onCloseSection) => <LibraryView onClose={onCloseSection} embedded />
  },
  {
    id: 'lattice',
    label: 'Constraint Lattice',
    description: 'Explore the constraint-space map and relationships.',
    shortcut: '⌘/Ctrl+3',
    render: () => <ConstraintLattice />
  },
  {
    id: 'erdos',
    label: 'Erdos Problem Dashboard',
    description: 'Track all Erdős open problems and generation-by-generation proof activity.',
    shortcut: '⌘/Ctrl+4',
    render: () => (
      <div style={{ padding: '16px' }}>
        <ErdosProblemsPanel />
      </div>
    )
  }
]

export const DEFAULT_SECTION_ID: AppSectionId = 'dashboard'
