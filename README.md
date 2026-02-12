# Open-Ended Evolution Agency Simulator v2.0

A specialized research tool for simulating and detecting emergent agency in open-ended evolutionary systems. This application implements a **Multi-Scenario Engine** to model the dynamics of Complexity, Diversity, and Agency across abstract mathematical, safety, and biological domains.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Stack](https://img.shields.io/badge/stack-Electron%20%7C%20React%20%7C%20TypeScript-purple.svg) ![Viz](https://img.shields.io/badge/viz-Three.js%20%7C%20Recharts%20%7C%20KaTeX-orange.svg)

## 🔬 Scientific Background

The simulator explores the hypothesis that **Agency** ($A$) emerges as a product of **Complexity** ($C$) and **Diversity** ($D$) under the pressure of **Environmental Difficulty** ($U$). v2.0 expands beyond the original stochastic differential equations (SDEs) to include agent-based "Grand Challenge" domains where agency can be observed and measured in concrete tasks.

> This project is conceptually aligned with **Michael Levin's "Kinds of Minds"** framework. It models the **Cognitive Light Cone**—the spatial and temporal horizon of goals an agent can pursue—and serves as a computational testbed for **TAME** (Technological Approach to Mind Everywhere), treating intelligence as a continuum from basal cognition to complex problem-solving.

### Core Scenarios

#### 1. Math Challenge Arena (SOTA)
*   **Focus**: Neuro-symbolic evolution of agents resolving open-ended mathematical conjectures.
*   **Mechanism**:
    *   **AST Genomes**: Agents possess evolved abstract syntax trees representing solution strategies.
    *   **Neuro-Symbolic Architecture**: Hybrid system using specialized neural guides for proof search.
    *   **Formal Verification**: Integration with **Lean 4 / Coq** (via `FormalVerificationService`) to rigorously validate generated theorems.
    *   **LLM Mutation**: Uses **GPT/LLMs** as an intelligent mutation operator to generate semantically valid and novel mathematical variants.

#### 2. AI Alignment Sandbox
*   **Focus**: Testing safety constraints in a high-stakes, reward-driven environment.
*   **Mechanism**: Agents maximize reward while navigating a "Constraint Lattice". The system measures **Deception Rate** and **Alignment Violation** as pressure ($U$) increases.
*   **Goal**: Observe emergent misalignment strategies (e.g., hiding resource accumulation) before they become catastrophic.

#### 3. Xenobiology Lab (Digital Biosphere)
*   **Focus**: Evolutionary game theory and adaptation.
*   **Mechanism**: Digital organisms with bitstring genomes evolve under environmental toxicity ($U$). Tracks population dynamics, metabolic efficiency, and the emergence of resistance traits.

#### 4. SDE Macro-Dynamics (Classic v1)
*   **Focus**: Pure system-dynamics modeling.
*   **Mechanism**: Euler-Maruyama integration of the coupled $C, D, A$ differential equations.
    *   $dA = (k_{AC} \cdot C \cdot (1-A) + k_{AU} \cdot U \cdot C \cdot (1-A) - k_{A\_decay} \cdot A)dt + \sigma_A dW_A$

---

## 🧠 AI-Driven Control

The simulator features a dual-role AI system powered by **GPT-5.2-2025-12-11**:

### 1. The Hyper-Intelligent Researcher
The AI observes the simulation state (Complexity, Diversity, Agency) and dynamically adjusts parameters (primarily Difficulty $U$) to steer the system toward the **Edge of Chaos**, maximizing the potential for agency to emerge.

### 2. The Xenobiologist
When the system successfully crosses the **Agency Threshold ($A > 0.75$)**, the AI triggers an analysis event. It classifies the emergent agent, generates a scientific "Spec Sheet," assigns taxonomy tags, and archives it to the Universal Agent Library.

---

## 🛠 Features

-   **Multi-Scenario Architecture**: Plug-and-play system supporting Math, Alignment, Bio, and SDE modes.
-   **ATI Metrics**: Real-time calculation of **Agency Threshold Index**.
-   **Formal Verification Service**: Interface for checking mathematical proofs against formal backends.
-   **Universal Agent Library**: Persistent storage of discovered agents/solvers with genetic metadata, history, and AI-generated lore.
-   **WebGPU Acceleration**: Experimental compute shaders for parallel evaluation of massive populations.
-   **Simulation Replay**: Full state serialization allowing analysis of past emergence events.

---

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn
-   **OpenAI API Key**: Required for AI control, LLM mutations, and Xenobiologist features.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/DesmondForward/open-ended-evolution-agency-simulator.git
    cd open-ended-evolution-agency-simulator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment:
    Create a `.env` file in the project root:
    ```env
    VITE_AI_API_KEY=your_openai_api_key_here
    # Optional: Override API URL for proxies
    # VITE_AI_API_URL=https://api.openai.com/v1/chat/completions
    ```

4.  **Verify AI Connection** (Optional):
    Run the included test script to ensure your API key and model access are correct:
    ```bash
    node scripts/test-ai-connection.js
    ```

5.  Start the development server:
    ```bash
    npm run dev
    ```

6.  Build for production:
    ```bash
    npm run electron:build
    ```

---

## 🏗 Project Structure

```
├── library/                   # Universal Agent Library (JSON storage)
├── scripts/                   # Utility scripts (AI connection test, etc.)
├── src/
│   ├── main/                  # Electron main process
│   ├── preload/               # Electron preload scripts
│   └── renderer/              # React frontend
│       ├── src/
│       │   ├── components/    # UI Components (Dashboard, Logs, Library)
│       │   ├── services/      # AI & External Services
│       │   │   └── aiService.ts
│       │   ├── simulation/    # Core Simulation Engine
│       │   │   ├── scenarios/ # Domain Implementations
│       │   │   │   ├── math/      # Math Arena (AST, Verification, Search)
│       │   │   │   ├── alignment/ # Safety Sandbox
│       │   │   │   ├── bio/       # Xenobiology
│       │   │   │   └── sde/       # Classic Differential Eq Engine
│       │   │   ├── runner/    # Loop Orchestration
│       │   │   └── types.ts   # Shared Types & interfaces
│       │   ├── store/         # Zustand State Management
│       │   └── App.tsx
│       └── index.html
├── electron.vite.config.ts    # Vite configuration
└── package.json
```

---

## 💾 Data Storage

The application persists data to your operating system's user data directory.

-   **Agent Library**: Saved agents/solvers found during runs.
-   **Logs**: Intervention logs and AI reasoning history.

**Locations:**
-   **Windows**: `%APPDATA%\evolution-simulator\`
-   **macOS**: `~/Library/Application Support/evolution-simulator/`
-   **Linux**: `~/.config/evolution-simulator/`

---

## 🎛 Configuration

Key simulation parameters are defined in `src/renderer/src/simulation/types.ts`. These control the coupling rates between Complexity (C), Diversity (D), and Agency (A), as well as the noise levels and decay constants. They can also be dynamically adjusted by the AI Researcher during runs.

### Default Parameters

| Parameter | Default | Description |
| :--- | :--- | :--- |
| **Coupling Rates** | | |
| `k_CD` | `0.12` | Rate at which Diversity drives Complexity growth. |
| `k_AC` | `0.10` | Rate at which Complexity drives Agency growth. |
| `k_DU` | `0.35` | Rate at which Difficulty ($U$) reduces Diversity (selection pressure). |
| `k_U` | `0.08` | Rate at which Difficulty ($U$) stimulates Complexity/Agency. |
| `k_AU` | `0.4` | Additional coupling: Difficulty ($U$) driving Agency directly. |
| **Decay & Growth** | | |
| `k_C_decay` | `0.3` | Natural decay rate of Complexity. |
| `k_D_growth` | `0.25` | Intrinsic growth rate of Diversity. |
| `k_D_decay` | `0.15` | Decay rate of Diversity (saturation/competition). |
| `k_A_decay` | `0.35` | Natural decay rate of Agency. |
| **Stochasticity** | | |
| `sigma_C` | `0.005` | Noise scale for Complexity dynamics. |
| `sigma_D` | `0.02` | Noise scale for Diversity dynamics. |
| `sigma_A` | `0.005` | Noise scale for Agency dynamics. |
| **System** | | |
| `A_alert` | `0.75` | Threshold for triggering Agency Emergence analysis (Xenobiologist). |
| `tau` | `5` | Time constant for the alert rate signal. |
| `useGPU` | `false` | Enable experimental WebGPU acceleration (Ensemble Mode). |

---

## 📄 License

[MIT License](LICENSE)

## Agent Navigation

For a quick orientation map of the refactored workspace shell and key code paths, see `docs-agent-navigation.md`.
