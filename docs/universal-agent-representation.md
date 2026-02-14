# Universal Agent Representation (SOTA direction)

## Why move beyond Final Stochastic Form?
The Final Stochastic Form is excellent for simulation dynamics, but poor for **cross-domain retrieval and invocation**. Modern agent ecosystems need:

1. A machine-readable capability profile.
2. A standardized invocation surface (e.g., Python/runtime-native adapters).
3. Retrieval-oriented metadata for intent/use-case matching.

## Selected approach: UARM-1 (Universal Agent Representation Manifest)
This implementation adds a manifest per library entry with:

- **Intents** and **domains** for semantic retrieval.
- **I/O contract** to express what the agent expects and returns.
- **Capabilities** and **safety notes** for operator trust.
- **Execution adapters** (`python`, `native`, extensible to `http`/`cli`).
- **Search tokens** for fast local retrieval.

## Summoning workflow
1. User/AI provides a natural-language use-case.
2. Library ranks entries via query overlap + quality priors (agency/confidence).
3. Top match returns a summon plan with executable invocation template.
4. AI can run the selected adapter directly (e.g., Python snippet).

## Why this is closer to SOTA
This follows proven patterns from tool/agent ecosystems:

- **Capability cards/model cards** style metadata.
- **Manifest-driven invocation** (similar to plugin/tool contracts).
- **Retrieval-first orchestration** via searchable semantic descriptors.

It keeps simulator equations as physics-level truth while adding an interop layer for agentic systems.
