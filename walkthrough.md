# GPU Offloading Verification

## Changes Implemented
- **WebGPU Engine**: Created `src/renderer/src/simulation/webGpuEngine.ts` to run the simulation on the RTX 5080 using WGSL compute shaders.
- **Ensemble Simulation**: The GPU mode runs **65,536 parallel simulations** and averages the results, providing a much higher-fidelity signal for the Agency metric.
- **UI Toggle**: Added a "GPU" button in the Dashboard controls to switch between Single (CPU) and Ensemble (GPU) modes.
- **AI Control**: Integrated `gpt-5.2-2025-12-11` as an autonomous researcher that adjusts the Environmental Difficulty ($U$) to maximize Agency.

## Verification Steps

### 1. Enable GPU Acceleration
1.  Launch the application.
2.  Look at the control bar (top left of Dashboard).
3.  Click the new **CPU/GPU** toggle button. It should switch to **GPU** and the icon should turn to a yellow lightning bolt.
4.  The tooltip should read: "Using RTX 5080 (Ensemble Mode)".

### 2. Performance Check
1.  Click **Start** to run the simulation.
2.  Observe the smoothness of the gauges and charts.
3.  Even though 65,536 agents are being simulated, the UI should remain responsive (60fps).
4.  Open Task Manager and check the **GPU Compute** usage for the NVIDIA RTX 5080. You should see activity.

### 3. Scientific Validation (Agency Detection)
1.  In **CPU Mode**, the Agency metric often fluctuates wildly because it's a single stochastic trajectory.
2.  In **GPU Mode**, the Agency metric represents the **Mean Field Agency** of the entire population. It should evolve more smoothly and robustly, providing a better signal for when the system truly transitions to a high-agency state.
3.  Try adjusting the `U` (Difficulty) slider. The Ensemble response to changes in `U` will be immediate and statistically significant.

### 4. Verify AI Control
1.  **Setup**: Ensure you have copied `.env.example` to `.env` and added your API Key.
2.  **Enable**: In the Dashboard right column, find the **AI Researcher** panel. Toggle it to **Active**.
3.  **Run**: Press Play.
4.  **Observe**:
    - The "CURRENT THOUGHT PROCESS" box will update periodically (e.g., every 50 simulation generations).
    - The AI will explain its reasoning (e.g., "Diversity is consistently high, increasing U to pressure the system.").
    - The **Parameter U** slider logic will update automatically to match the AI's decision.
5.  **Network**: Check the "Network" tab in DevTools to see calls to the AI API.

### 5. Troubleshooting with Test Script
If you encounter issues, we have provided a connection test script:
1.  Open your terminal in the project root.
2.  Run `node scripts/test-ai-connection.js`.
3.  This will verify API Key loading and send a test request to `gpt-5.2-2025-12-11`, printing the response or detailed error.

## Troubleshooting
- If the simulation stops or doesn't update when GPU is enabled, check the Developer Tools Console (Ctrl+Shift+I).
- If you see "WebGPU not supported", ensure you are running Electron 29+ or a configured browser.
- **AI 401 Error**: API Key is missing or invalid in `.env`. Restart the app after changing `.env`.
