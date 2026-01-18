# Open-Ended Virtual Evolution Simulator // Agency Detector

A specialized research tool for simulating and detecting emergent agency in open-ended evolutionary systems. This application implements a Stochastic Differential Equation (SDE) engine to model the dynamics of Complexity, Diversity, and Agency within a theoretical ecosystem.

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Stack](https://img.shields.io/badge/stack-Electron%20%7C%20React%20%7C%20TypeScript-purple.svg) ![Viz](https://img.shields.io/badge/viz-Recharts%20%7C%20Lucide%20%7C%20KaTeX-orange.svg)

## 🔬 Scientific Background

This simulator operates on the hypothesis that **Agency** ($A$) emerges as a product of **Complexity** ($C$) and **Diversity** ($D$) under the pressure of **Environmental Difficulty** ($U$).

The core simulation engine utilizes **Euler-Maruyama integration** to solve the following system of Stochastic Differential Equations:

1.  **Complexity Dynamics** ($dC$):
    $$dC = (k_{CD} \cdot D \cdot (1-C) + k_U \cdot U \cdot (1-C) - k_{C\_decay} \cdot C)dt + \sigma_C dW_C$$
    *Models complexity growth via diversity-driven innovation and environmental challenge.*

2.  **Diversity Dynamics** ($dD$):
    $$dD = (k_{D\_growth}(1-D) - k_{DU} \cdot U \cdot D - k_{D\_decay}D^2)dt + \sigma_D dW_D$$
    *Models the balance between niche creation and selection pressure.*

3.  **Agency Dynamics** ($dA$):
    $$dA = (k_{AC} \cdot C \cdot (1-A) + k_{AU} \cdot U \cdot C \cdot (1-A) - k_{A\_decay} \cdot A)dt + \sigma_A dW_A$$
    *Models agency as a higher-order property emerging from complexity, accelerated by challenge.*

4.  **Alert Rate** ($dA_{alert}$):
    $$dA_{alert\_rate} = \frac{1}{\tau} \cdot \sigma(\frac{A - A_{alert}}{\epsilon})dt$$
    *Smooths the detection signal to identify robust threshold crossings indicating emergent agency.*

## 🧠 AI-Driven Control

The simulator features a dual-role AI system powered by **GPT-5.2-2025-12-11**:

### 1. The Hyper-Intelligent Researcher
The AI observes the simulation state (Complexity, Diversity, Agency) and dynamically adjusts:
-   **Environmental Difficulty ($U$)**: To challenge the system or protect it from collapse.
-   **Full SDE Parameter Tuning**: Fine-tuning stochastic coefficients ($k_{CD}$, $k_{AC}$, $k_{C\_decay}$, etc.) and noise levels ($\sigma$) to steer the system.
-   **Strategy & Memory**: The AI maintains a history of its actions to analyze the effectiveness of its interventions over time.

### 2. The Xenobiologist
When the system successfully crosses the Agency Threshold ($A > 0.75$), the AI assumes the role of a Xenobiologist:
-   **Analysis**: Reviews the history and parameter "DNA" that led to emergence.
-   **Classification**: Generates a scientific name, "Spec Sheet" description, and tags for the new agent.
-   **Archival**: Saves the agent to the **Universal Agent Library**.

## ✨ Features

-   **Real-time SDE Integration**: High-performance Euler-Maruyama solver running in the renderer process.
-   **Universal Agent Library**: A persistent collection of discovered "Agents" (agency peaks), complete with their parameter "DNA", emergence history, and AI-generated lore. Stored as JSON files.
-   **WebGPU Acceleration**: Experimental WGSL-based implementation for massive parallel simulations (Ensemble Mode).
-   **AI Parameter Tuning**: Autonomous optimization of simulation parameters by an LLM agent.
-   **Agency Detection System**: Automated monitoring system that triggers alerts when agency ($A$) crosses critical thresholds.
-   **Interactive Dashboard**:
    -   Live telemetry charts for $C$, $D$, and $A$ using **Recharts**.
    -   Real-time "Agency Alert" logging.
    -   Environment Control Slider ($U$ - Novelty/Difficulty).
    -   Mathematical Typesetting with **KaTeX**.
    -   Universal Library browser with **Lucide** icons.
-   **Validation Framework**: Built-in metrics to track state bounds violations and diversity floor compliance.
-   **Modern Tech Stack**: Built with Electron, React, TypeScript, and Zustand for state management.

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
