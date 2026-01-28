
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
    AIHistoryEntry,
    ScenarioMetadata,
    InterventionLogEntry,
    ScenarioEvent
} from '../simulation/types';
import { fetchAIControl, generateAgentDescription } from '../services/aiService';
import { SavedAgent } from '../simulation/types';
import { ScenarioRunner } from '../simulation/runner/ScenarioRunner';
import { SDEScenario } from '../simulation/scenarios/sde/SDEScenario';
import { MathScenario } from '../simulation/scenarios/math/MathScenario';
import { AlignmentScenario } from '../simulation/scenarios/alignment/AlignmentScenario';
import { BioScenario } from '../simulation/scenarios/bio/BioScenario';
import { AgentsScenario } from '../simulation/scenarios/agents/AgentsScenario';

interface SimulationStore {
    // State
    isPlaying: boolean;
    currentState: SimulationState;
    parameters: SimulationParameters;
    control: ControlSignal;
    telemetry: TelemetryPoint[];
    alerts: AlertEvent[];
    events: ScenarioEvent[]; // Global event log
    validationMetrics: ValidationMetrics;

    // Scenario Management
    currentScenarioId: string;
    scenarioMetadata: ScenarioMetadata;
    availableScenarios: ScenarioMetadata[];

    // Agent Library
    savedAgents: SavedAgent[];

    // AI Control
    isAIControlled: boolean;
    aiStatus: 'idle' | 'thinking' | 'cooldown';
    aiReasoning: string;
    lastAiUpdate: Date | null;
    aiHistory: AIHistoryEntry[];
    interventionLog: InterventionLogEntry[];

    // Persistence
    bestAgency: number;
    bestParameters: SimulationParameters | null;
    bestControl: ControlSignal | null;
    lastSavedGeneration: number;

    // Actions
    togglePlay: () => void;
    toggleAIControl: () => void;
    reset: () => void;
    setControl: (U: number) => void;
    updateParameters: (params: Partial<SimulationParameters>) => void;
    switchScenario: (id: string) => void;
    loadBestParameters: () => void;
    triggerAI: () => Promise<void>;
    step: () => Promise<void>; // Driven by UI loop or internal runner hooks?
    loadAgents: () => Promise<void>;
    exportState: () => string;
    importState: (json: string) => boolean;
}

// Max telemetry points to keep in memory for charting
const MAX_TELEMETRY_POINTS = 1000;
const MAX_EVENT_LOGS = 100;

// Initialize Scenarios
const sdeScenario = new SDEScenario();
const mathScenario = new MathScenario();
const alignmentScenario = new AlignmentScenario();
const bioScenario = new BioScenario();
const agentsScenario = new AgentsScenario();

const scenarios: Record<string, any> = {
    'sde-v1': sdeScenario,
    'math': mathScenario,
    'alignment': alignmentScenario,
    'bio': bioScenario,
    'agents': agentsScenario
};

// Initialize Runner
const runner = new ScenarioRunner({
    onTelemetry: (data) => {
        useSimulationStore.getState().handleTelemetry(data);
    },
    onEvent: (event) => {
        useSimulationStore.getState().handleEvent(event);
    }
});

// Set default scenario
runner.setScenario(sdeScenario);
runner.setTPS(20);

// Load initial best from localStorage
const storedBest = localStorage.getItem('fipsm_best_parameters');
const storedLastGen = localStorage.getItem('fipsm_last_saved_gen');
const initialBest = storedBest ? JSON.parse(storedBest) : null;

export const useSimulationStore = create<SimulationStore & { handleTelemetry: (pt: TelemetryPoint) => void, handleEvent: (evt: any) => void }>((set, get) => ({
    // Initial State
    isPlaying: false,
    currentState: { ...DEFAULT_INITIAL_STATE },
    parameters: initialBest ? { ...DEFAULT_PARAMETERS, ...initialBest.parameters } : { ...DEFAULT_PARAMETERS },
    control: initialBest && initialBest.control ? { ...initialBest.control } : { ...DEFAULT_CONTROL },
    telemetry: [],
    alerts: [],
    events: [],
    validationMetrics: {
        stateBoundsViolationRate: 0,
        diversityFloorViolationFraction: 0,
        controlBoundsViolationRate: 0
    },

    currentScenarioId: 'sde-v1',
    scenarioMetadata: sdeScenario.metadata,
    availableScenarios: [
        sdeScenario.metadata,
        mathScenario.metadata,
        alignmentScenario.metadata,
        bioScenario.metadata,
        agentsScenario.metadata
    ],

    savedAgents: [],
    isAIControlled: true,
    aiStatus: 'idle',
    aiReasoning: "Initializing AI Control...",
    lastAiUpdate: null,
    aiHistory: [],
    interventionLog: [],

    // Persistence
    bestAgency: initialBest ? initialBest.agency : 0,
    bestParameters: initialBest ? initialBest.parameters : null,
    bestControl: initialBest ? initialBest.control : null,
    lastSavedGeneration: storedLastGen ? parseInt(storedLastGen) : 0,

    // Actions
    togglePlay: () => {
        const { isPlaying } = get();
        if (isPlaying) {
            runner.pause();
        } else {
            runner.start();
        }
        set({ isPlaying: !isPlaying });
    },

    toggleAIControl: () => set((state) => ({ isAIControlled: !state.isAIControlled })),

    reset: () => {
        runner.stop();
        const currentId = get().currentScenarioId;
        scenarios[currentId].initialize(Date.now(), get().parameters); // Re-init with current params
        runner.setScenario(scenarios[currentId]);

        set({
            isPlaying: false,
            currentState: { ...DEFAULT_INITIAL_STATE }, // Reset UI state display
            telemetry: [],
            alerts: [],
            events: [],
            aiReasoning: "",
            aiHistory: [],
        });
    },

    setControl: (U: number) => {
        const { control, currentState, interventionLog } = get();
        const newControl = { ...control, U };
        runner.setControl(newControl);

        const logEntry: InterventionLogEntry = {
            id: crypto.randomUUID(),
            timestamp: currentState.generation,
            realtime: new Date(),
            source: 'USER',
            action: `Set U = ${U.toFixed(2)}`
        };

        set({ control: newControl, interventionLog: [...interventionLog, logEntry] });
    },

    updateParameters: (newParams) => {
        const merged = { ...get().parameters, ...newParams };
        // If current scenario supports config update, do it
        const currentId = get().currentScenarioId;
        const scenario = scenarios[currentId];

        if (scenario.updateConfig) {
            scenario.updateConfig(merged as any);
        }

        const logEntry: InterventionLogEntry = {
            id: crypto.randomUUID(),
            timestamp: get().currentState.generation,
            realtime: new Date(),
            source: 'USER',
            action: `Updated Parameters: ${Object.keys(newParams).join(', ')}`
        };

        set({ parameters: merged, interventionLog: [...get().interventionLog, logEntry] });
    },

    switchScenario: (id: string) => {
        if (!scenarios[id]) return;
        runner.stop();

        const scenario = scenarios[id];
        // Re-initialize? Or keep state? Usually switch = fresh start or resume.
        // Let's re-initialize to be safe for now.
        scenario.initialize(Date.now());

        runner.setScenario(scenario);

        set({
            currentScenarioId: id,
            scenarioMetadata: scenario.metadata,
            isPlaying: false,
            telemetry: [],
            alerts: [],
            events: []
        });
    },

    loadBestParameters: () => {
        const { bestParameters, bestControl } = get();
        if (bestParameters) {
            const newParams = { ...DEFAULT_PARAMETERS, ...bestParameters };
            get().updateParameters(newParams);

            if (bestControl) {
                get().setControl(bestControl.U);
            }
        }
    },

    // Internal Handler called by Runner
    handleTelemetry: (point: TelemetryPoint) => {
        // AI Logic Hook (Throttle? Or run here?)
        // For MVP, lets just call the async AI step trigger here occasionally
        get().step(); // Trigger generic step logic (AI, etc)

        set(state => {
            const newTelemetry = [...state.telemetry, point];
            if (newTelemetry.length > MAX_TELEMETRY_POINTS) newTelemetry.shift();
            return {
                telemetry: newTelemetry,
                currentState: {
                    ...state.currentState,
                    generation: point.generation,
                    C: point.C,
                    D: point.D,
                    A: point.A,
                    alertRate: point.alertRate
                }
            };
        });
    },

    handleEvent: (event: any) => { // Type as ScenarioEvent
        set(state => {
            const newEvents = [...state.events, event];
            if (newEvents.length > MAX_EVENT_LOGS) newEvents.shift(); // Keep last 100

            const updates: any = { events: newEvents };

            if (event.type === 'threshold_crossed') {
                const newAlert: AlertEvent = {
                    id: crypto.randomUUID(),
                    generation: event.timestamp,
                    agencyLevel: event.data.A || 0, // Fallback
                    timestamp: new Date(),
                    type: 'threshold_crossed'
                };
                updates.alerts = [...state.alerts, newAlert];
            }

            return updates;
        });
    },

    triggerAI: async () => {
        const { currentState, parameters, control, isAIControlled, aiHistory, scenarioMetadata, savedAgents, bestAgency, bestParameters, bestControl, interventionLog } = get();
        if (!isAIControlled) return;

        set({ aiStatus: 'thinking' });

        // Call AI Service
        const decision = await fetchAIControl(
            currentState,
            parameters,
            control,
            scenarioMetadata,
            aiHistory,
            bestAgency,
            bestParameters,
            bestControl,
            savedAgents
        );

        if (decision) {
            const newIntervention: InterventionLogEntry = {
                id: crypto.randomUUID(),
                timestamp: currentState.generation,
                realtime: new Date(),
                source: 'AI',
                action: `Set U=${decision.u.toFixed(2)}${decision.params ? ' + Params' : ''}`,
                reasoning: decision.reasoning
            };

            const newHistoryEntry: AIHistoryEntry = {
                generation: currentState.generation,
                action: `Set U=${decision.u.toFixed(2)}`,
                u: decision.u,
                params: decision.params,
                reasoning: decision.reasoning,
                outcome: { A_before: currentState.A, A_after: currentState.A, delta_A: 0 }
            };

            set({
                control: { ...control, U: decision.u },
                aiReasoning: decision.reasoning,
                lastAiUpdate: new Date(),
                aiStatus: 'idle',
                aiHistory: [...aiHistory, newHistoryEntry],
                interventionLog: [...interventionLog, newIntervention]
            });

            // Apply to Runner
            runner.setControl({ U: decision.u });
            if (decision.params) {
                const merged = { ...parameters, ...decision.params };
                const currentScenario = scenarios[get().currentScenarioId];
                if (currentScenario.updateConfig) {
                    currentScenario.updateConfig(merged);
                }
                set({ parameters: merged });
            }
        } else {
            set({ aiStatus: 'idle' });
        }
    },

    step: async () => {
        // This is now mostly for AI triggering since the Runner handles the physics loop
        const { isAIControlled, aiStatus, lastAiUpdate, triggerAI } = get();

        if (isAIControlled && aiStatus === 'idle') {
            const now = Date.now();
            const lastUpdate = lastAiUpdate ? lastAiUpdate.getTime() : 0;
            const AI_UPDATE_INTERVAL_MS = 10000; // 10 seconds

            if (now - lastUpdate > AI_UPDATE_INTERVAL_MS) {
                // Trigger AI Analysis
                triggerAI();
            }
        }
    },

    loadAgents: async () => {
        const win = window as any;
        if (win.api && win.api.getAgents) {
            try {
                const agents = await win.api.getAgents();
                set({ savedAgents: agents });
            } catch (e) {
                console.error("[SimulationStore] Failed to load agents:", e);
            }
        }
    },

    exportState: () => {
        const state = get();
        const currentScenario = scenarios[state.currentScenarioId];

        const snapshot = {
            meta: {
                version: '2.0.0',
                timestamp: Date.now(),
                scenarioId: state.currentScenarioId
            },
            store: {
                parameters: state.parameters,
                control: state.control,
                bestAgency: state.bestAgency,
                aiHistory: state.aiHistory,
                interventionLog: state.interventionLog,
                currentState: state.currentState
            },
            scenarioData: currentScenario.serialize()
        };

        return JSON.stringify(snapshot, null, 2);
    },

    importState: (json: string) => {
        try {
            const snapshot = JSON.parse(json);

            // Validate basic structure
            if (!snapshot.meta || !snapshot.store || !snapshot.scenarioData) {
                console.error("Invalid snapshot format");
                return false;
            }

            const scenarioId = snapshot.meta.scenarioId;
            if (!scenarios[scenarioId]) {
                console.error("Unknown scenario ID:", scenarioId);
                return false;
            }

            // Stop runner
            runner.stop();

            // Switch scenario without re-init (we will deserialize)
            const scenario = scenarios[scenarioId];

            // Restore Scenario State
            scenario.deserialize(snapshot.scenarioData);

            // Restore Store State
            set({
                currentScenarioId: scenarioId,
                scenarioMetadata: scenario.metadata,
                parameters: snapshot.store.parameters,
                control: snapshot.store.control,
                bestAgency: snapshot.store.bestAgency,
                aiHistory: snapshot.store.aiHistory || [],
                interventionLog: snapshot.store.interventionLog || [],
                currentState: snapshot.store.currentState, // Restore UI metrics immediately
                isPlaying: false,
                telemetry: [], // Clear telemetry or try to restore? Telemetry is transient mostly.
                alerts: [],
                events: [] // Reset events on import
            });

            // Set runner context
            runner.setScenario(scenario);
            runner.setControl(snapshot.store.control);

            return true;
        } catch (e) {
            console.error("Failed to import state:", e);
            return false;
        }
    }
}));
