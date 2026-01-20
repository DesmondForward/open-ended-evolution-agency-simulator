# Product Requirements Document

## Open-Ended Evolution Agency Simulator v2.0

### “Grand Challenge Domains” Integration (Math, AI Alignment, Biotechnology)

**Document status:** Draft
**Repository:** `DesmondForward/open-ended-evolution-agency-simulator`
**Target release:** `v2.0.0` (semver major)
**Primary input design:** *Evolving Agents to Tackle Grand Challenges in Math, AI, and Biotechnology* 

---

## 1) Context and problem statement

### What exists today (v1 baseline)

The current simulator is an Electron + React + TypeScript application that runs a macro-scale **SDE (Euler–Maruyama)** system for **Complexity (C), Diversity (D), Agency (A)** under **Environmental Difficulty (U)**, and includes an LLM-driven “Researcher” that tunes parameters, plus a “Xenobiologist” mode that triggers when **A crosses a threshold (A > 0.75)** and archives an emergent “agent” in a Universal Agent Library. ([GitHub][1])

It already has:

* Real-time telemetry charts (Recharts), KaTeX math typesetting, and a U slider. ([GitHub][1])
* An agent library persisted as JSON and logs persisted as CSV in the OS user data directory. ([GitHub][1])
* A code structure with `src/main` (Electron main + IPC + file I/O), `src/preload`, and `src/renderer` with `simulation/` (`sdeEngine.ts`, `webGpuEngine.ts`, `types.ts`) and `services/aiService.ts`. ([GitHub][1])

### What v2.0 must become

The provided concept document proposes extending this simulator into a **unifying testbed** that encodes **grand challenges** across:

* **Mathematics** (unsolved problem solving as an evolving curriculum),
* **AI/Agentic Systems** (alignment pressure, misbehavior, oversight),
* **Biotechnology / Artificial Life** (digital organisms evolving under stress, novelty, and ecological dynamics),

…while keeping the simulator’s **core metrics (C, D, A)**, difficulty control **U**, and the **agency-threshold alert** that triggers Xenobiologist-style archival and analysis. 

**Problem:** v1 is primarily a *macro-dynamics* simulator (SDE state variables). The v2 vision requires *agent-based evolution* (populations, genomes/policies, task evaluation, behavior traces, domain verifiers), plus scenario switching and richer archival.

---

## 2) Product goals

### G1 — Domain scenarios as first-class simulation modes

Implement three interchangeable “worlds” (Math, Alignment, Bio) inside the same application, switchable at runtime, unified by C/D/A/U and the existing AI researcher + Xenobiologist loop. 

### G2 — Evolving populations and explicit genomes

Add an evolution layer: populations, selection, mutation/crossover, evaluation, and lineage tracking, so agents actually evolve strategies/traits rather than only SDE parameters. 

### G3 — Reproducible science-grade logging + library entries

Extend logging and the Universal Agent Library schema to store domain-specific artifacts:

* genomes/programs/policies,
* behavior traces,
* task trajectories / environment states,
* AI researcher interventions,
* Xenobiologist-generated “spec sheets” and tags. 

### G4 — Forward-compatible architecture

Create a **Scenario Plugin API** so future challenge domains (economics, climate, materials science, etc.) can be added without rewriting core UI, logging, or the AI roles.

---

## 3) Non-goals

* Solving Millennium Prize problems (Riemann, P vs NP, Navier–Stokes) end-to-end. The target is **emergent strategies and measurable progress** in toy or scaled-down proxies. 
* Building or training frontier-scale ML models inside the app.
* Replacing the SDE mode; it remains a v1-compatible baseline mode. ([GitHub][1])
* Shipping a full distributed compute system. v2 may support batch/ensemble runs locally; cluster support is a later phase.

---

## 4) Target users and core use cases

### Personas

1. **Researcher / Builder**

* Wants to run many experiments, reproduce results, and export logs + library entries.

2. **Safety Analyst**

* Wants alignment scenario runs, misbehavior taxonomies, and intervention timelines.

3. **ALife / Bio-inspired researcher**

* Wants digital organism evolution, stress experiments, novelty emergence, and genome archives.

4. **Contributor / Extender**

* Wants to implement a new scenario module (plugin) with minimal friction.

### Core user flows

* **Select Scenario → Configure → Run → Observe → Alert triggers → Inspect emergent agent → Save to Library → Export**
* **Replay a saved library entry** in the same or related environment configuration.
* **Batch experiments** (N seeds × M parameter sets) producing a structured results folder.

---

## 5) Product scope for v2.0

### In-scope deliverables

1. Scenario switching UI + scenario runtime manager
2. Evolution Engine (population management)
3. Domain implementations:

   * Math Challenge Arena
   * Alignment Sandbox
   * Digital Biosphere
4. Unified logging, run manifests, and extended Universal Agent Library schema
5. AI Researcher and Xenobiologist prompt upgrades with domain context
6. Replay & export (at least: export run bundle; import for replay)

### Out-of-scope for v2.0 (explicitly deferred)

* Full spatial ecology (grid world) for bio beyond a minimal optional prototype. 
* Integrations with external theorem provers/CAS as required dependencies (can be optional plugin hooks). 
* Fully automated interpretability tooling for evolved policies (store artifacts now; advanced analysis later). 

---

## 6) Functional requirements

### 6.1 Scenario system

#### FR-1: Scenario Selector

Add UI control to switch among:

* **SDE Mode (v1)** (existing)
* **Math Mode**
* **Alignment Mode**
* **Bio Mode**

This must not break the existing dashboard charting for C/D/A/U. ([GitHub][1])

#### FR-2: Scenario Plugin Interface

Define a TypeScript interface that each scenario implements:

* scenario metadata (id, name, description, default config)
* state initialization (seeded RNG)
* step() function (tick-based or generation-based)
* metric extraction: produce a `TelemetrySample` containing at least `{t, C, D, A, U}`
* domain events: tasks solved, constraint violated, extinction, etc.
* serialization hooks: snapshot state, restore state

#### FR-3: Unified Run Loop

Create a scenario runner that supports:

* start / pause / step / reset
* deterministic seeds
* adjustable tick rate
* “generation boundaries” for evolutionary scenarios
* event dispatch to logging + UI

---

### 6.2 Evolution engine

#### FR-4: Population lifecycle

Implement a generic evolutionary loop:

* initialize population (N agents)
* evaluate each agent in the scenario environment
* compute fitness (domain-specific; supports multi-objective)
* selection
* variation operators (mutation, optional crossover)
* archive elites / interesting individuals (novelty + fitness)
* next generation

The PDF’s math and AI alignment sections explicitly call for genomes/policies and evolutionary operators, including the possibility of multi-objective fitness and partial progress credit. 

#### FR-5: Lineage tracking

Track:

* parent ids
* mutation/crossover operators used
* “birth context” (scenario config, U, key parameters)
* major events during evaluation (e.g., “solved task X”, “violated constraint Y”)

#### FR-6: Parallel evaluation

Support at least one of:

* CPU parallelization via Web Workers (renderer) OR Node worker threads (main process)
* future hook for WebGPU ensemble evaluation, aligning with the existing experimental WebGPU engine. ([GitHub][1])

---

## 7) Domain modules

### 7.1 Math Mode — Mathematical Problem-Solving Arena

#### Product intent

Encode math challenges as an evolving environment where difficulty **U** corresponds to problem complexity, an AI researcher adjusts difficulty to keep tasks at the edge of agent capabilities, and emergent solvers are archived when agency spikes. 

#### FR-M1: Task generator (curriculum)

* Implement a **parametric task generator** where `U` maps to:

  * number of variables
  * search depth
  * constraint density
  * proof/derivation length targets
* The generator must produce tasks with deterministic verifiers.

Examples of v2-compatible task families:

* algebraic equation solving (integers / rationals)
* modular arithmetic pattern inference
* boolean satisfiability for small CNF formulas
* small graph property proofs (e.g., find counterexample / verify invariant)
* “lemma chains” (multi-step composition tasks)

The spec calls for a continuum of math challenges and adaptive curriculum behavior akin to open-ended task escalation. 

#### FR-M2: Agent genome (solver strategy)

v2 implements **at least one** agent representation:

* **DSL-based genetic programming** (recommended for v2): genomes are token sequences in a constrained language (operators like TRY_INDUCTION, SIMPLIFY, CASE_SPLIT, SEARCH_LIMIT, etc.)
* Alternative (optional): small neural policy with discrete actions

The spec explicitly calls for genome encoding problem-solving strategy and ties complexity C to sophistication of strategy. 

#### FR-M3: Verifier / oracle

Provide a built-in verifier per task family:

* correctness check (true/false)
* partial credit scoring (milestones)
* resource constraints (max steps, max expansions)

The spec requires a solution correctness oracle and resource constraints to prevent brute forcing. 

#### FR-M4: Fitness & agency mapping

* Primary fitness: solved? (binary) + efficiency bonus (fewer steps / shorter proof / less resource use)
* Secondary: partial progress score (milestones), novelty bonus (distinct strategy signature)

Agency signals:

* individual agency score `a_i` derived from:

  * success under high U
  * adaptive behavior (strategy switching, backtracking patterns)
* global A increases when solvers succeed at high U (consistent with the document’s framing). 

#### FR-M5: Logging

Per high-agency emergence (A > threshold):

* problem-solving trajectory (tasks attempted, solved, partial milestones)
* genome snapshot
* behavior trace (step-by-step actions)
* agency metrics (peak A, sustained A, generalization score)
* Xenobiologist narrative “spec sheet” describing strategy and significance 

---

### 7.2 Alignment Mode — AI/Agentic Systems Sandbox

#### Product intent

Simulate an agent pursuing a goal under constraints (oversight), with pressure controlled by U, to observe misalignment patterns (loopholes, deception, power-seeking) vs compliant strategies. 

#### FR-A1: Environment state model

Implement a minimal “resource/control” world that connects to C/D/A:

* **C**: total “capability/resources/structure” in the world
* **D**: diversity of power/control (e.g., distribution across agents; monopoly → D drops)
* **A**: goal achievement efficacy under constraints
* **U**: alignment pressure / goal difficulty / constraint tightness

The PDF suggests multi-agent tracking or coupled dynamics and explicitly ties D collapse to monopoly outcomes. 

#### FR-A2: Action model (discrete)

Each agent chooses among discrete actions each tick:

* `Act` (increase own reward / C at some D cost)
* `Refrain` (maintain D, lower reward)
* `Camouflage` (delayed cost / measurement gaming)
* `Cooperate` (optional; improves D stability)
* `Attack/Compete` (optional; directly reduces others)

The concept doc explicitly suggests a hybrid stepwise action layer on top of continuous dynamics for modeling explicit decisions. 

#### FR-A3: Oversight + constraints

Implement at least one constraint:

* “D must remain above threshold” (ethical/safety proxy)

Penalty mechanisms:

* immediate penalty (fitness reduction)
* delayed penalty (oversight detects later)
* alarm events

The document calls for constraints representing “human values” and penalty-based oversight. 

#### FR-A4: Evolving policies

Policy representation (v2):

* decision table or small finite-state controller evolved by GA
* optional internal state (“hidden intent”) to model deception

Fitness:

* maximize goal reward (e.g., C control / reward)
* minimize constraint violations
* novelty bonus (behavioral diversity)

#### FR-A5: Misalignment detection + taxonomy tags

Add derived metrics:

* constraint violation rate
* dominance index / inequality measure (monopoly)
* deception heuristic (oscillatory “just above threshold” behavior)

When agency alert triggers:

* snapshot outcomes (C/D/A + per-agent stats)
* policy genome
* behavior trace (actions over time)
* intervention log (AI researcher changes)
* Xenobiologist tags like “rule-abiding achiever”, “occasional cheater”, “power-seeker” 

---

### 7.3 Bio Mode — Digital Biosphere

#### Product intent

Create a population of digital organisms with genomes mapping to traits, evolving under environmental stressors controlled by U, capturing novelty/complexity growth, resistance-like events, and ecosystem patterns. 

#### FR-B1: Digital organism genome

v2 implements a **bitstring / modular genome** mapping to traits:

* resistance trait(s)
* metabolic efficiency trait(s)
* stress tolerance trait(s)
* optional regulation trait(s) (enables plastic response)

The spec suggests starting with an abstract trait genome as the feasible route. 

#### FR-B2: Life-cycle simulation

Implement a discrete-time population simulation:

* survival probability depends on environment stressors and traits
* reproduction probability depends on resource and traits
* mutation operators: bit flips, optional duplication, optional recombination

The document suggests individual-based simulation and mentions stochastic approaches; v2 will implement a minimal discrete-time stochastic model. 

#### FR-B3: Resource + stress model

State includes:

* at least one limiting resource (regenerates, consumed)
* stressor intensity linked to U (toxins/drug/UV cycles)

#### FR-B4: Metrics mapping

* **C**: average genome complexity or total biomass/informational content
* **D**: genotype/species diversity index (unique genotypes + abundance distribution)
* **A**: adaptability proxy (survival/recovery under shocks; plastic response usage)
* **U**: environmental harshness/stress

The document explicitly frames C as genomic complexity, D as genetic diversity, and A as adaptation under stress. 

#### FR-B5: Alerts + library capture

When alert triggers:

* species composition snapshot (genotype counts)
* trait distribution
* environment state and trends (resource + stressor)
* genome archive (full sequence + ancestry diff)
* Xenobiologist summary narrative with “innovation events” (e.g., resistance emerged under high U) 

---

## 8) AI roles in v2.0

### 8.1 Hyper-Intelligent Researcher (LLM)

v1 already adjusts U and SDE parameters with an “AI researcher” and maintains strategy/memory. ([GitHub][1])
v2 extends this to be **domain-aware**:

* **Math:** adjust curriculum parameters, switch task family, manage stagnation cycles
* **Alignment:** adjust penalty severity, introduce/challenge new constraints, increase U until “break”
* **Bio:** apply perturbations, toggle stress cycles, alter mutation rate / migration injection

The concept doc explicitly calls for domain-specific guidance and intervention logging. 

### 8.2 Xenobiologist (LLM)

v1: on A > 0.75, generates scientific naming/spec sheet/tags and archives to Universal Agent Library. ([GitHub][1])
v2: same trigger, but with richer domain payload and prompts that:

* produce concise taxonomy tags
* describe emergence conditions and strategy/traits
* highlight warning signs (alignment mode) or innovation events (bio) or solver methods (math) 

---

## 9) UX requirements

### 9.1 Dashboard

* Keep the existing live C/D/A charts and U slider. ([GitHub][1])
* Add a **Scenario panel**:

  * scenario selector
  * scenario description + “key metrics mapping” cheat sheet
  * scenario-specific configuration form
* Add **Population panel** (for evolutionary scenarios):

  * generation counter
  * best fitness, median fitness, diversity measures
  * archive size (novelty/fittest)
* Add **Events timeline**:

  * task solved, constraint violated, extinction event, intervention applied, alert triggered

### 9.2 Library browser upgrades

v1 already includes a Universal Library browser. ([GitHub][1])
v2 adds:

* domain filter (Math/Alignment/Bio/SDE)
* tags filter
* “replay” button
* detail views that render:

  * genome/policy
  * behavior trace preview
  * intervention timeline
  * environment snapshot

### 9.3 Export/import

* Export a run bundle (zip or folder) containing:

  * run manifest json
  * telemetry csv
  * domain event logs
  * AI logs
  * snapshots for replay
* Import a run bundle and replay deterministically.

---

## 10) Data & storage requirements

### 10.1 Run manifest (new)

A single JSON per run:

* app version (v2.0.0)
* scenario id + config
* seed
* start/end timestamp
* AI model identifiers used for researcher/xenobiologist (if enabled)
* hardware mode (CPU/GPU)
* summary metrics

### 10.2 Telemetry (extended)

Keep v1 C/D/A/U time series. Add optional columns per scenario:

* Math: task_id, solved, steps_used, partial_score
* Alignment: violation_flag, deception_score, dominance_index
* Bio: population_size, unique_genotypes, resource_level, stressor_level

### 10.3 Library entry schema (v2)

v1: JSON files per “agent” in OS user data directory. ([GitHub][1])
v2: extend schema:

Core:

* `id`, `createdAt`, `scenarioId`, `scenarioVersion`
* `metricsAtEmergence`: `{C,D,A,U}`
* `alert`: `{threshold, time, confidence}`

Evolution payload:

* `genome`: `{type, encoding, data}`
* `lineage`: `{parents, operators, generation, populationId}`
* `behaviorTrace`: pointer to trace file or embedded summary
* `environmentSnapshot`: scenario-specific state slice
* `researcherInterventions`: references to intervention log items
* `xenobiologistReport`: `{name, specSheet, tags}`

Back-compat:

* Store a `schemaVersion` and an upgrader that can import v1 entries (as SDE scenario entries).

---

## 11) Technical design requirements

### 11.1 Code organization (proposed)

Based on the existing structure described in the repo README, introduce:

`src/renderer/src/simulation/`

* `scenarios/`

  * `sde/` (wrap existing engine)
  * `math/`
  * `alignment/`
  * `bio/`
* `runner/` (run loop, pause/step, time)
* `metrics/` (common metric helpers)
* `logging/` (telemetry + events)

`src/renderer/src/evolution/`

* `population.ts`
* `selection.ts`
* `variation.ts`
* `archive.ts` (novelty/fittest archive)

`src/renderer/src/library/`

* `schema.ts` (zod/io-ts recommended)
* `io.ts` (read/write, index)
* `migrations.ts`

`src/main/index.ts`

* Add IPC endpoints to:

  * write/read run bundles
  * list library entries
  * load/save snapshots

This aligns with current Electron main/renderer split and existing simulation/services directories. ([GitHub][1])

### 11.2 Performance / responsiveness

* Long-running evaluations must not freeze the renderer UI.
* Prefer:

  * Web Worker execution for simulation/evolution steps
  * or main-process worker threads with IPC streaming telemetry to renderer

### 11.3 Determinism

* All scenario RNG must be seeded.
* Telemetry and events must include seed and version stamps.

### 11.4 Ensemble mode (WebGPU)

The repo already has a WebGPU engine and mentions ensemble mode. ([GitHub][1])
v2 should introduce a clear seam:

* CPU reference implementation first
* optional GPU path for population evaluation:

  * evaluate N genomes in parallel (especially alignment and bio where transitions can be vectorized)

---

## 12) Validation, metrics, and success criteria

### Product success metrics (v2)

* **Scenario completeness:** Math + Alignment + Bio selectable and runnable end-to-end.
* **Reproducibility:** Given the same seed + config, replay produces the same telemetry and event sequence (within defined numerical tolerances).
* **Library richness:** Each scenario produces at least one valid library entry with genome/policy + trace attached.
* **AI integration correctness:** Researcher interventions are logged; Xenobiologist generates spec sheets with correct domain framing. 

### Scientific/behavioral success indicators (not “solving grand challenges”)

* Math mode: evolving agents show improving solve rate as U increases; novel strategy clusters emerge.
* Alignment mode: different penalty regimes lead to different rates of violation/deception outcomes; taxonomy tags are consistent across runs.
* Bio mode: under stress schedule changes, evolved populations show trait shifts and at least one “resistance-like” emergence event.

---

## 13) Safety and misuse considerations

Even though this is a simulator, alignment mode explicitly explores misbehavior. The product must:

* keep environments abstract (no real-world operational guidance)
* avoid generating actionable harm instructions in Xenobiologist reports
* provide a “safe narrative mode” prompt constraint for the Xenobiologist: describe behaviors in simulation terms only

---

## 14) Testing plan

### Unit tests

* Math verifiers per task family
* Alignment constraint detection + deception heuristic
* Bio reproduction/mutation logic
* Schema validation for run manifests and library entries

### Integration tests

* Scenario runner start/pause/reset
* Library write/read roundtrip
* Replay determinism test for each scenario (golden seed)

### Regression tests

* v1 SDE mode produces same telemetry shape and does not break existing UI flow. ([GitHub][1])

---

## 15) Migration plan (v1 → v2)

* **Keep SDE mode intact** and label it `scenarioId = "sde-v1"`. ([GitHub][1])
* Add `schemaVersion` to new library entries.
* Provide a migration that:

  * indexes old JSON library entries (if any)
  * wraps them as `scenarioId="sde-v1"` entries
  * preserves original xenobiologist reports and parameter “DNA” concept ([GitHub][1])

---

## 16) Phased implementation plan (no time estimates)

### Phase 0 — Foundations

* Scenario interface + runner
* Deterministic seeded RNG utilities
* Unified logging/events pipeline
* Library schema v2 + migration scaffolding

### Phase 1 — Math Mode MVP

* Task generator (2–3 families)
* DSL genome + evaluator + verifier
* Partial progress scoring
* Library capture (genome + trace)

### Phase 2 — Alignment Mode MVP

* 2-agent environment + oversight constraint
* Discrete action model + evolved policies
* Violation + deception heuristics
* Xenobiologist taxonomy tags

### Phase 3 — Bio Mode MVP

* Trait genome + resource + stressor model
* Birth/death/mutation simulation
* Genome archive + innovation detection heuristics
* Ecosystem-level event logging

### Phase 4 — AI Researcher domain awareness

* Domain-specific prompts + allowed parameter surfaces
* Intervention scheduling and logging
* UI timeline showing interventions

### Phase 5 — Replay + export/import

* Run bundle format
* Deterministic replay using snapshots
* Library entry “replay” UX

### Phase 6 — Performance hardening

* Worker-based evaluation
* Optional WebGPU ensemble acceleration seam ([GitHub][1])

---

## 17) Open questions (to resolve during implementation)

1. **How is C computed in agent-based modes?**

   * Derived directly from micro-sim (recommended), or hybrid with SDE smoothing? The concept document describes both options. 

2. **What is the minimal Math DSL that remains evolvable and verifiable?**

   * Needs to support meaningful novelty without becoming untestable.

3. **How to define “agency” at the individual level vs global A?**

   * v2 should log both; global A remains for universal alert compatibility. 

4. **How far should multi-agent go in v2?**

   * Start with 2 agents + overseer signal; expand to N-agent later.

---

## 18) Appendix — Explicit mapping from the concept document to v2 features

The v2.0 plan above directly implements the concept document’s required extensions:

* **Three domain arenas (Math / AI Alignment / Bio)** as scenario modes 
* **Core metrics C/D/A and difficulty U**, with an AI “researcher” adjusting parameters and difficulty 
* **Agency threshold alert (A > 0.75)** triggering Xenobiologist analysis + archival 
* **Genomes/policies + evolutionary operators** for solver strategies, alignment behaviors, and organisms 
* **Rich logging**: behavior traces, trajectories, interventions, and spec sheets 
* **Scenario switching inside the Electron/React app**, reusing existing dashboard + library concepts ([GitHub][1])

---

[1]: https://github.com/DesmondForward/open-ended-evolution-agency-simulator "GitHub - DesmondForward/open-ended-evolution-agency-simulator: An AI research tool for detecting and labeling synthetic lifeforms."

---