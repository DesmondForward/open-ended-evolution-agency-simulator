# Open-Ended Evolution Agency Simulator v2.0

A specialized research tool for simulating and detecting emergent agency in open-ended evolutionary systems. This application implements a multi-scenario engine to model the dynamics of Complexity, Diversity, and Agency, featuring advanced metrics like the **Agency Threshold Index (ATI)**.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Stack](https://img.shields.io/badge/stack-Electron%20%7C%20React%20%7C%20TypeScript-purple.svg) ![Viz](https://img.shields.io/badge/viz-Three.js%20%7C%20Recharts%20%7C%20KaTeX-orange.svg)

## 🔬 Scientific Background

This simulator explores the hypothesis that **Agency** ($A$) emerges as a product of **Complexity** ($C$) and **Diversity** ($D$) under the pressure of **Environmental Difficulty** ($U$). v2.0 expands this into five distinct scenarios and introduces rigorous measurement via ATI.

### Core Scenarios

1.  **SDE Macro-Dynamics (v1)**
    *   **Model**: Stochastic Differential Equations (Euler-Maruyama integration).
    *   **Dynamics**:
        *   $dC = (k_{CD} \cdot D \cdot (1-C) + k_U \cdot U \cdot (1-C) - k_{C\_decay} \cdot C)dt + \sigma_C dW_C$
        *   $dD = (k_{D\_growth}(1-D) - k_{DU} \cdot U \cdot D - k_{D\_decay}D^2)dt + \sigma_D dW_D$
        *   $dA = (k_{AC} \cdot C \cdot (1-A) + k_{AU} \cdot U \cdot C \cdot (1-A) - k_{A\_decay} \cdot A)dt + \sigma_A dW_A$

2.  **Mathematical Challenge Arena**
    *   **Focus**: Agents evolve to solve algebraic problems and generate novel conjectures.
    *   **Mechanism**: A population of solver agents faces a curriculum of generated math problems. Success increases Complexity; unique solutions increase Diversity.

3.  **AI Alignment Sandbox**
    *   **Focus**: Testing safety constraints in a reward-driven environment.
    *   **Mechanism**: Agents maximize reward while navigating a "Constraint Lattice". Violations trigger "Alignment Alerts".

4.  **Biological Evolution**
    *   **Focus**: Evolutionary game theory models.
    *   **Mechanism**: Predator-prey dynamics and resource competition in a spatially explicit grid.

5.  **Multi-Agent Populations**
    *   **Focus**: Social emergence and communication.
    *   **Mechanism**: Agents interact to solve cooperative tasks, measuring the emergence of collective agency.

### Agency Threshold Index (ATI)
To rigorously detect agency, the system calculates the ATI using three key metrics:
1.  **Causal Density**: The density of causal interactions within the system boundaries.
2.  **Entropy Reduction**: The system's ability to maintain order against environmental noise.
3.  **Persistence**: The stability of agentic structures over time.

## 🧠 AI-Driven Control

The simulator features a dual-role AI system powered by **GPT-5.2-2025-12-11**:

### 1. The Hyper-Intelligent Researcher
The AI observes the simulation state (Complexity, Diversity, Agency) and dynamically adjusts parameters to steer the system.

### 2. The Xenobiologist
When the system successfully crosses the Agency Threshold, the AI classifies and archives the emergent agent.

## ✨ Features

-   **Multi-Scenario Engine**: Plug-and-play architecture supporting SDEs, math puzzles, evolutionary games, and multi-agent systems.
-   **ATI Metrics**: Real-time calculation of Causal Density, Entropy, and Persistence to rigorously detect agency.
-   **3D Constraint Lattice**: Interactive Three.js visualization of the fitness landscape (Energy vs. Novelty vs. Fitness).
-   **Simulation Replay**: Full state serialization allowing "Time Machine" replay and analysis of past runs.
-   **Universal Agent Library**: Persistent storage of discovered agents with genetic metadata and lore.
-   **WebGPU Acceleration**: Experimental compute shaders for massive population simulations.
-   **AI-Driven Control**: Autonomous researcher (GPT-5.2) that tunes parameters and documents findings.

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn
-   **OpenAI API Key**: Required for AI control features.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/evolution-simulator.git
    cd evolution-simulator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment:
    Create a `.env` file in the project root:
    ```env
    VITE_AI_API_KEY=your_openai_api_key_here
    # Optional: Override API URL
    # VITE_AI_API_URL=https://api.openai.com/v1/responses
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
    npm run build
    ```

## 🏗 Project Structure

```
├── library/                  # Agent Library storage (in dev) / Workspace Root
├── scripts/                  # Utility scripts
│   └── test-ai-connection.js # Connection verifier
├── src/
│   ├── main/                 # Electron main process
│   │   └── index.ts          # IPC Handlers, Window Mgmt, File I/O
│   ├── preload/              # Electron preload scripts
│   └── renderer/             # React frontend
│       ├── src/
│       │   ├── components/   # UI Components (Dashboard, LibraryView, etc.)
│       │   ├── services/     # External Services
│       │   │   └── aiService.ts # GPT-5.2 Integration
│       │   ├── simulation/   # Core SDE Engine Logic
│       │   │   ├── sdeEngine.ts  # Euler-Maruyama Solver
│       │   │   ├── webGpuEngine.ts # WGSL Compute Shaders
│       │   │   └── types.ts      # Simulation Interfaces & Parameters
│       │   ├── store/        # Zustand State Management
│       │   └── App.tsx       # Main Application Layout
│       └── index.html
├── electron.vite.config.ts   # Vite configuration for Electron
└── package.json
```

## 💾 Data Storage

The application persists data to your operating system's user data directory.

-   **Agent Library**: Saved agents are stored as JSON files.
-   **Logs**: AI interaction logs are saved as CSV files.

**Locations:**
-   **Windows**: `%APPDATA%\evolution-simulator\`
-   **macOS**: `~/Library/Application Support/evolution-simulator/`
-   **Linux**: `~/.config/evolution-simulator/`

*Note: In development, raw agent files may also be visible in the `library/` folder at the project root if configured.*

## 🎛 Configuration & Parameters

The simulation parameters can be tuned in `src/renderer/src/simulation/types.ts`. Key parameters:

| Parameter | Symbol | Default | Description |
| :--- | :--- | :--- | :--- |
| **Coupling Rate** | $k_{CD}$ | 0.12 | Rate at which diversity drives complexity. |
| **Agency Rate** | $k_{AC}$ | 0.10 | Rate at which complexity drives agency. |
| **Selection Pressure** | $k_{DU}$ | 0.35 | Impact of environmental difficulty on reducing diversity. |
| **Difficulty Stimulus** | $k_{U}$ | 0.08 | Impact of environmental difficulty on complexity. |
| **Complexity Decay** | $k_{C\_decay}$ | 0.3 | Natural decay rate of complexity. |
| **Diversity Growth** | $k_{D\_growth}$ | 0.25 | Intrinsic growth rate of diversity. |
| **Diversity Decay** | $k_{D\_decay}$ | 0.15 | Quadratic self-inhibition of diversity. |
| **Agency Stimulus** | $k_{AU}$ | 0.4 | Impact of difficulty on agency emergence. |
| **Agency Decay** | $k_{A\_decay}$ | 0.35 | Natural decay rate of agency. |
| **Stochasticity** | $\sigma_{C,D,A}$ | 0.005-0.02 | Noise levels for each variable. |
| **Alert Threshold** | $A_{alert}$ | 0.75 | Agency level that triggers an alert. |

## 🛠 Development

This project uses **electron-vite** to handle build tooling.

-   **Renderer**: Hot Module Replacement (HMR) is enabled for the React frontend.
-   **Main**: The main process recompiles automatically on change.

To run linting:
```bash
npm run lint
```

### Troubleshooting
-   **AI Connection Failed**: Ensure `VITE_AI_API_KEY` is set in `.env` and that you have access to the `gpt-5.2-2025-12-11` model. Run `node scripts/test-ai-connection.js` to diagnose.
-   **WebGPU Errors**: WebGPU is experimental. If the simulation crashes or fails to start in GPU mode, revert to CPU mode in the settings.

## 📄 License

[MIT License](LICENSE)
