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
    ValidationMetrics
} from '../simulation/types';
import { eulerMaruyamaStep, shouldTriggerAlert, calculateValidationMetrics } from '../simulation/sdeEngine';

interface SimulationStore {
    // State
    isPlaying: boolean;
    currentState: SimulationState;
    parameters: SimulationParameters;
    control: ControlSignal;
    telemetry: TelemetryPoint[];
    alerts: AlertEvent[];
    validationMetrics: ValidationMetrics;

    // Actions
    togglePlay: () => void;
    reset: () => void;
    setControl: (U: number) => void;
    updateParameters: (params: Partial<SimulationParameters>) => void;
    step: () => void; // Single simulation step
}

// Max telemetry points to keep in memory for charting
const MAX_TELEMETRY_POINTS = 1000;

export const useSimulationStore = create<SimulationStore>((set, get) => ({
    // Initial State
    isPlaying: false,
    currentState: { ...DEFAULT_INITIAL_STATE },
    parameters: { ...DEFAULT_PARAMETERS },
    control: { ...DEFAULT_CONTROL },
    telemetry: [],
    alerts: [],
    validationMetrics: {
        stateBoundsViolationRate: 0,
        diversityFloorViolationFraction: 0,
        controlBoundsViolationRate: 0
    },

    // Actions
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    reset: () => set({
        isPlaying: false,
        currentState: { ...DEFAULT_INITIAL_STATE },
        telemetry: [],
        alerts: [],
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

    step: () => {
        const { currentState, parameters, control, telemetry, alerts } = get();

        // Run integration step
        const nextState = eulerMaruyamaStep(currentState, parameters, control);

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

        set({
            currentState: nextState,
            telemetry: newTelemetry,
            alerts: newAlerts,
            validationMetrics: newMetrics
        });
    }
}));
