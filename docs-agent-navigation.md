# Agent Navigation Guide

This repository now exposes a **workspace-style shell** in the renderer so an agent (or human operator) can quickly jump to the right operating surface.

## In-app navigation

- **Dashboard (`Ctrl/Cmd+1`)**: Main simulation controls, charts, alerts, and logs.
- **Agent Library (`Ctrl/Cmd+2`)**: Saved agents and historical equations.
- **Constraint Lattice (`Ctrl/Cmd+3`)**: Visual constraint-space exploration.

Global controls still work from all views:

- **Play/Pause:** `Space`
- **Reset simulation:** `Ctrl/Cmd+R`

## Code map for fast orientation

- `src/renderer/src/App.tsx` — app shell orchestration and global keyboard shortcuts.
- `src/renderer/src/navigation/appSections.tsx` — source-of-truth section registry.
- `src/renderer/src/components/layout/` — shell-specific UI (`AppHeader`, `SectionNavRail`).
- `src/renderer/src/components/` — view-level simulation panels.
- `src/renderer/src/simulation/` — simulation engines, scenarios, metrics.
- `src/main/` — Electron main process and persistence.

## Extension pattern

To add a new top-level app view:

1. Create a renderable component.
2. Add an entry in `APP_SECTIONS` in `navigation/appSections.tsx`.
3. Optionally add a keyboard shortcut in `App.tsx`.

This keeps view discovery centralized and avoids modal-only navigation.
