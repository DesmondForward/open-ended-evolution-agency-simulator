# Open-Ended Virtual Evolution Simulator // Agency Detector

A specialized research tool for simulating and detecting emergent agency in open-ended evolutionary systems. This application implements a Stochastic Differential Equation (SDE) engine to model the dynamics of Complexity, Diversity, and Agency within a theoretical ecosystem.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Stack](https://img.shields.io/badge/stack-Electron%20%7C%20React%20%7C%20TypeScript-purple.svg)

## 🔬 Scientific Background

This simulator operates on the hypothesis that **Agency** ($A$) emerges as a product of **Complexity** ($C$) and **Diversity** ($D$) under the pressure of **Environmental Difficulty** ($U$).

The core simulation engine utilizes **Euler-Maruyama integration** to solve the following system of Stochastic Differential Equations:

1.  **Complexity Dynamics** ($dC$):
    $$dC = (k_{CD} \cdot D \cdot (1-C) + k_U \cdot U \cdot (1-C) - 0.3C)dt + \sigma_C dW_C$$
    *Models complexity growth via diversity-driven innovation and environmental challenge.*

2.  **Diversity Dynamics** ($dD$):
    $$dD = (0.25(1-D) - k_{DU} \cdot U \cdot D - 0.15D^2)dt + \sigma_D dW_D$$
    *Models the balance between niche creation and selection pressure.*

3.  **Agency Dynamics** ($dA$):
    $$dA = (k_{AC} \cdot C \cdot (1-A) + 0.4 \cdot U \cdot C \cdot (1-A) - 0.35A)dt + \sigma_A dW_A$$
    *Models agency as a higher-order property emerging from complexity, accelerated by challenge.*

4.  **Alert Rate** ($dA_{alert}$):
    $$dA_{alert\_rate} = \frac{1}{\tau} \cdot \sigma(\frac{A - A_{alert}}{\epsilon})dt$$
    *Smooths the detection signal to identify robust threshold crossings indicating emergent agency.*

## ✨ Features

-   **Real-time SDE Integration**: High-performance Euler-Maruyama solver running at 60fps (default).
-   **Agency Detection System**: Automated monitoring system that triggers alerts when agency ($A$) crosses critical thresholds.
-   **Interactive Dashboard**:
    -   Live telemetry charts for $C$, $D$, and $A$.
    -   Real-time "Agency Alert" logging.
    -   Environment Control Slider ($U$ - Novelty/Difficulty).
-   **Validation Framework**: Built-in metrics to track state bounds violations and diversity floor compliance.
-   **Modern Tech Stack**: Built with Electron, React, TypeScript, and Zustand for state management.

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18+ recommended)
-   npm or yarn

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

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Build for production:
    ```bash
    npm run build
    ```

## 🏗 Project Structure

```
├── src/
│   ├── main/                 # Electron main process
│   │   └── index.ts          # Application entry point
│   ├── preload/              # Electron preload scripts
│   └── renderer/             # React frontend
│       ├── src/
│       │   ├── components/   # UI Components (Dashboard, Charts)
│       │   ├── simulation/   # Core SDE Engine Logic
│       │   │   ├── sdeEngine.ts  # Euler-Maruyama Solver
│       │   │   └── types.ts      # Simulation Interfaces & Parameters
│       │   ├── store/        # Zustand State Management
│       │   └── App.tsx       # Main Application Layout
│       └── index.html
├── electron.vite.config.ts   # Vite configuration for Electron
└── package.json
```

## 🎛 Configuration & Parameters

The simulation uses default parameters defined in `src/renderer/src/simulation/types.ts`. Key parameters include:

| Parameter | Symbol | Default | Description |
| :--- | :--- | :--- | :--- |
| **Coupling Rate** | $k_{CD}$ | 0.12 | Rate at which diversity drives complexity. |
| **Agency Rate** | $k_{AC}$ | 0.10 | Rate at which complexity drives agency. |
| **Selection Pressure** | $k_{DU}$ | 0.35 | Impact of environmental difficulty on reducing diversity. |
| **Stochasticity** | $\sigma_{C,D,A}$ | 0.02-0.05 | Noise levels for each variable. |
| **Alert Threshold** | $A_{alert}$ | 0.7 | Agency level that triggers an alert. |

## 🛠 Development

This project uses **electron-vite** to handle build tooling.

-   **Renderer**: Hot Module Replacement (HMR) is enabled for the React frontend.
-   **Main**: The main process recompiles automatically on change.

To run linting:
```bash
npm run lint
```

## 📄 License

[MIT License](LICENSE)
