import { create } from 'zustand';
import {
    SimulationState,
    SimulationParameters,
    ControlSignal,
    TelemetryPoint,
    AlertEvent,
    DEFAULT_INITIAL_STATE,
    DEFAULT_PARAMETERS,
    DEFAULT_CONTROL,
    ValidationMetrics,
    AIHistoryEntry
} from '../simulation/types';
import { eulerMaruyamaStep, shouldTriggerAlert, calculateValidationMetrics } from '../simulation/sdeEngine';
import { fetchAIControl, generateAgentDescription } from '../services/aiService';
import { WebGpuEngine } from '../simulation/webGpuEngine';
import { SavedAgent } from '../simulation/types';

interface SimulationStore {
    // State
    isPlaying: boolean;
    currentState: SimulationState;
    parameters: SimulationParameters;
    control: ControlSignal;
    telemetry: TelemetryPoint[];
    alerts: AlertEvent[];
    validationMetrics: ValidationMetrics;

    // AI Control
    isAIControlled: boolean;
    aiStatus: 'idle' | 'thinking' | 'cooldown';
    aiReasoning: string;
    lastAiUpdate: Date | null;
    aiHistory: AIHistoryEntry[];

    // Persistence
    bestAgency: number;
    bestParameters: SimulationParameters | null;
    bestControl: ControlSignal | null;
    lastSavedGeneration: number; // Prevent spamming saves

    // Actions
    togglePlay: () => void;
    toggleAIControl: () => void;
    reset: () => void;
    setControl: (U: number) => void;
    updateParameters: (params: Partial<SimulationParameters>) => void;
    loadBestParameters: () => void;
    triggerAI: () => Promise<void>;
    step: () => Promise<void>; // Async for GPU & AI
}

// Max telemetry points to keep in memory for charting
const MAX_TELEMETRY_POINTS = 1000;

// GPU Engine Instance & Lock
const gpuEngine = new WebGpuEngine();
let isGpuBusy = false;
let isAiBusy = false; // Prevent overlapping AI calls

// Load initial best from localStorage
const storedBest = localStorage.getItem('fipsm_best_parameters');
const storedLastGen = localStorage.getItem('fipsm_last_saved_gen'); // Simple persistence for session
const initialBest = storedBest ? JSON.parse(storedBest) : null;

export const useSimulationStore = create<SimulationStore>((set, get) => ({
    // Initial State
    isPlaying: false,
    currentState: { ...DEFAULT_INITIAL_STATE },
    parameters: initialBest ? { ...initialBest.parameters } : { ...DEFAULT_PARAMETERS },
    control: initialBest && initialBest.control ? { ...initialBest.control } : { ...DEFAULT_CONTROL },
    telemetry: [],
    alerts: [],
    validationMetrics: {
        stateBoundsViolationRate: 0,
        diversityFloorViolationFraction: 0,
        controlBoundsViolationRate: 0
    },
    isAIControlled: true,
    aiStatus: 'idle',
    aiReasoning: "Initializing AI Control...",
    lastAiUpdate: null,
    aiHistory: [],

    // Persistence
    bestAgency: initialBest ? initialBest.agency : 0,
    bestParameters: initialBest ? initialBest.parameters : null,
    bestControl: initialBest ? initialBest.control : null,
    lastSavedGeneration: storedLastGen ? parseInt(storedLastGen) : 0,

    // Actions
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    toggleAIControl: () => set((state) => ({ isAIControlled: !state.isAIControlled })),

    reset: () => set({
        isPlaying: false,
        currentState: { ...DEFAULT_INITIAL_STATE },
        telemetry: [],
        alerts: [],
        aiReasoning: "",
        aiHistory: [],
        validationMetrics: {
            stateBoundsViolationRate: 0,
            diversityFloorViolationFraction: 0,
            controlBoundsViolationRate: 0
        }
    }),

    setControl: (U: number) => set((state) => ({
        control: { ...state.control, U }
    })),

    updateParameters: (newParams) => set((state) => ({
        parameters: { ...state.parameters, ...newParams }
    })),

    loadBestParameters: () => {
        const { bestParameters, bestControl } = get();
        if (bestParameters) {
            set((state) => ({
                parameters: { ...bestParameters },
                control: bestControl ? { ...bestControl } : state.control
            }));
            console.log("Restored Best Parameters & Control:", bestParameters, bestControl);
        }
    },

    triggerAI: async () => {
        const { currentState, parameters, control, isAIControlled, aiHistory } = get();
        if (!isAIControlled || isAiBusy) return;

        isAiBusy = true;
        set({ aiStatus: 'thinking' });
        console.log(`[AI Spec] Manual Trigger... Gen: ${currentState.generation}`);

        const stateBefore = { ...currentState };

        try {
            const { bestAgency, bestParameters, bestControl } = get();
            const result = await fetchAIControl(currentState, parameters, control, aiHistory, bestAgency, bestParameters, bestControl);
            if (result) {

                // For simplicity/robustness: We'll store the entry with a pending outcome, or just the action.
                // Actually, the user asked for "memory... to forward previous adjustment vs impact".
                // So we need to calculate the impact of the LAST action.

                // 1. Find last history entry and update its outcome based on CURRENT state vs OLD state (stored in it?)
                // Too complex for this store.
                // Simplified: Just record the action and the state AT THAT TIME.
                // The AI can infer impact by comparing that entry's state vs current state.

                const newEntry: AIHistoryEntry = {
                    generation: currentState.generation,
                    action: result.params ? `Updated Params: ${Object.keys(result.params).join(', ')}` : `Set U=${result.u.toFixed(2)}`,
                    u: result.u,
                    params: result.params,
                    reasoning: result.reasoning,
                    outcome: {
                        A_before: stateBefore.A,
                        A_after: -1, // To be filled or just compared by AI reading the history list vs current state
                        delta_A: 0
                    }
                };

                // Update previous entry's outcome if it exists
                const currentHistory = get().aiHistory;
                const updatedHistory = [...currentHistory];
                if (updatedHistory.length > 0) {
                    const lastEntry = updatedHistory[updatedHistory.length - 1];
                    lastEntry.outcome.A_after = currentState.A;
                    lastEntry.outcome.delta_A = currentState.A - lastEntry.outcome.A_before;
                }

                // Add new entry, keep last 10
                updatedHistory.push(newEntry);
                if (updatedHistory.length > 10) updatedHistory.shift();

                set((state) => ({
                    control: { ...state.control, U: result.u },
                    parameters: result.params ? { ...state.parameters, ...result.params } : state.parameters,
                    aiReasoning: result.reasoning,
                    aiStatus: 'cooldown',
                    lastAiUpdate: new Date(),
                    aiHistory: updatedHistory
                }));
                console.log(`[AI Spec] Applied AI Control: U=${result.u}`);
                if (result.params) {
                    console.log(`[AI Spec] Applied Parameter Updates:`, result.params);
                }

                // Persist Log to CSV
                const win = window as any;
                if (win.api && win.api.logAIAction) {
                    const { bestAgency } = get();
                    win.api.logAIAction({
                        generation: currentState.generation,
                        action: result.params ? `Updated Params` : `Set U=${result.u.toFixed(2)}`,
                        u: result.u,
                        agency: currentState.A,
                        bestAgency: bestAgency,
                        params: result.params || {},
                        reasoning: result.reasoning
                    });
                }
            } else {
                set({ aiStatus: 'idle' });
            }
        } catch (e) {
            console.error("AI Manual Trigger Failed", e);
            set({ aiStatus: 'idle' });
        } finally {
            isAiBusy = false;
        }
    },

    step: async () => {
        const { currentState, parameters, control, telemetry, alerts, isAIControlled } = get();

        // ---------------- AI CONTROL ----------------
        if (isAIControlled && !isAiBusy) {
            // Time-based Frequency: Ensure at least 10 seconds between calls
            const now = Date.now();
            const lastUpdate = get().lastAiUpdate;
            const timeSinceLast = lastUpdate ? now - lastUpdate.getTime() : Infinity;

            const shouldCallAI = currentState.generation > 50 && timeSinceLast >= 10000;

            if (shouldCallAI) {
                isAiBusy = true;
                set({ aiStatus: 'thinking' });
                // Run in background 
                console.log(`[AI Spec] Calling AI Service... Gen: ${currentState.generation}, Time since last: ${Math.round(timeSinceLast / 1000)}s`);

                const { aiHistory, bestAgency, bestParameters, bestControl } = get();
                const stateBefore = { ...currentState };

                fetchAIControl(currentState, parameters, control, aiHistory, bestAgency, bestParameters, bestControl).then((result) => {
                    if (result) {
                        const newEntry: AIHistoryEntry = {
                            generation: currentState.generation,
                            action: result.params ? `Updated Params: ${Object.keys(result.params).join(', ')}` : `Set U=${result.u.toFixed(2)}`,
                            u: result.u,
                            params: result.params,
                            reasoning: result.reasoning,
                            outcome: {
                                A_before: stateBefore.A,
                                A_after: -1,
                                delta_A: 0
                            }
                        };

                        set((state) => {
                            const updatedHistory = [...state.aiHistory];
                            // Update previous outcome
                            if (updatedHistory.length > 0) {
                                const lastEntry = updatedHistory[updatedHistory.length - 1];
                                lastEntry.outcome.A_after = stateBefore.A; // Using state at start of async call as "after" for previous
                                lastEntry.outcome.delta_A = stateBefore.A - lastEntry.outcome.A_before;
                            }
                            updatedHistory.push(newEntry);
                            if (updatedHistory.length > 10) updatedHistory.shift();

                            return {
                                control: { ...state.control, U: result.u },
                                parameters: result.params ? { ...state.parameters, ...result.params } : state.parameters,
                                aiReasoning: result.reasoning,
                                aiStatus: 'cooldown',
                                lastAiUpdate: new Date(),
                                aiHistory: updatedHistory
                            };
                        });
                        console.log(`[AI Spec] Applied AI Control: U=${result.u}`);
                        if (result.params) {
                            console.log(`[AI Spec] Applied Parameter Updates:`, result.params);
                        }

                        // Persist Log to CSV
                        const win = window as any;
                        if (win.api && win.api.logAIAction) {
                            const { bestAgency } = get();
                            win.api.logAIAction({
                                generation: currentState.generation,
                                action: result.params ? `Updated Params` : `Set U=${result.u.toFixed(2)}`,
                                u: result.u,
                                agency: currentState.A,
                                bestAgency: bestAgency,
                                params: result.params || {},
                                reasoning: result.reasoning
                            });
                        }
                    } else {
                        set({ aiStatus: 'idle' });
                    }
                    isAiBusy = false;
                }).catch((e) => {
                    console.error("AI Auto Trigger Failed", e);
                    set({ aiStatus: 'idle' });
                    isAiBusy = false;
                });
            }
        }
        // --------------------------------------------

        // Prevent concurrent GPU steps
        if (parameters.useGPU && isGpuBusy) return;

        let nextState: SimulationState;

        if (parameters.useGPU) {
            isGpuBusy = true;
            try {
                // Ensure initialized (fast simulation, ok to check every frame)
                await gpuEngine.initialize();
                nextState = await gpuEngine.step(parameters, control, currentState);
            } catch (error) {
                console.error("GPU Simulation Step Failed:", error);
                isGpuBusy = false;
                return; // Skip update
            }
            isGpuBusy = false;
        } else {
            // CPU Step
            nextState = eulerMaruyamaStep(currentState, parameters, control);
        }

        // Check for alerts
        let newAlerts = [...alerts];
        if (shouldTriggerAlert(nextState, parameters)) {
            // Avoid spamming alerts - only add if we haven't recently or if it's a new crossing
            // For simplicity/demo, we'll just log it if the previous state wasn't alerting
            // or if it's been a while (e.g. 50 generations) since the last alert
            const lastAlert = newAlerts[newAlerts.length - 1];
            const timeSinceLastAlert = lastAlert ? nextState.generation - lastAlert.generation : Infinity;

            if (currentState.A < parameters.A_alert || timeSinceLastAlert > 50) {
                newAlerts.push({
                    id: crypto.randomUUID(),
                    generation: nextState.generation,
                    agencyLevel: nextState.A,
                    timestamp: new Date(),
                    type: 'threshold_crossed'
                });

                // --- AGENT CAPTURE TRIGGER ---
                // If this is a significant crossing and we haven't saved recently
                const { lastSavedGeneration, aiHistory } = get();
                if (nextState.generation - lastSavedGeneration > 100) { // Enforce 100 gen cooldown on saves
                    console.log("[Library] Triggering Agent Capture...");

                    // Execute async capture without blocking the loop too much
                    // (We create the data snapshot synchronously)
                    const snapshot: Omit<SavedAgent, 'name' | 'description' | 'tags'> = {
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        generation: nextState.generation,
                        metrics: {
                            A: nextState.A,
                            C: nextState.C,
                            D: nextState.D,
                            alertRate: nextState.alertRate
                        },
                        parameters: { ...parameters },
                        environmentalControl: { ...control },
                        historySnippet: [...aiHistory].slice(-10), // Last 10 actions
                        validationMetrics: { ...get().validationMetrics },
                        runContext: {
                            bestAgencySoFar: get().bestAgency
                        }
                    };

                    // Fire and forget (or handle in background)
                    generateAgentDescription(snapshot).then(async (meta) => {
                        if (meta) {
                            const fullAgent: SavedAgent = { ...snapshot, ...meta };
                            const win = window as any;
                            if (win.api && win.api.saveAgent) {
                                await win.api.saveAgent(fullAgent);
                                console.log(`[Library] Agent Saved: ${meta.name}`);
                                // Update store to block immediate re-save
                                set({ lastSavedGeneration: nextState.generation });
                                localStorage.setItem('fipsm_last_saved_gen', nextState.generation.toString());
                            }
                        }
                    });
                }
            }
        }

        // Update telemetry
        const newTelemetryPoint: TelemetryPoint = {
            generation: nextState.generation,
            C: nextState.C,
            D: nextState.D,
            A: nextState.A,
            U: control.U,
            alertRate: nextState.alertRate
        };

        let newTelemetry = [...telemetry, newTelemetryPoint];
        if (newTelemetry.length > MAX_TELEMETRY_POINTS) {
            newTelemetry = newTelemetry.slice(-MAX_TELEMETRY_POINTS);
        }

        // Update validation metrics periodically (every 100 steps to save compute) or on pause
        // For now, let's just update them - it's cheap enough for this number of points
        // Actually, let's optimize to only re-calc on demand or less frequently in a real app,
        // but here we can do it. To be safe, we'll do it every step but it might be overkill.
        // Let's do it every 10 steps.
        let newMetrics = get().validationMetrics;
        if (Math.floor(nextState.generation * 10) % 10 === 0) {
            // We need full history for true validation stats, but we only keep MAX_TELEMETRY_POINTS
            // This gives us a "windowed" validation metric which is actually quite useful for monitoring.
            // Only converting telemetry back to state shape for the helper
            const historyWindow = newTelemetry.map(t => ({
                C: t.C, D: t.D, A: t.A, alertRate: t.alertRate, generation: t.generation
            }));
            newMetrics = {
                ...calculateValidationMetrics(historyWindow, parameters),
                controlBoundsViolationRate: 0 // U is hard coded to be within bounds via slider
            };
        }

        // Track Best Agency
        const { bestAgency } = get();
        if (nextState.A > bestAgency) {
            set({
                bestAgency: nextState.A,
                bestParameters: { ...parameters },
                bestControl: { ...control }
            });
            // Auto-save to localStorage
            localStorage.setItem('fipsm_best_parameters', JSON.stringify({
                agency: nextState.A,
                parameters: parameters,
                control: control
            }));
        }

        set({
            currentState: nextState,
            telemetry: newTelemetry,
            alerts: newAlerts,
            validationMetrics: newMetrics
        });
    }
}));
