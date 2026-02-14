import { SimulationState, SimulationParameters, ControlSignal, AIHistoryEntry, ScenarioMetadata } from '../simulation/types';
import { LibraryEntry, LegacyAgent } from '../../../shared/agentLibrary';
import { validateAiControlResponsePayload, validateAiDescriptionResponsePayload, AiDescriptionResponsePayload } from '../../../shared/ipcValidation';

export const fetchAIControl = async (
    state: SimulationState,
    currentParams: SimulationParameters,
    control: ControlSignal,
    scenarioMetadata: ScenarioMetadata,
    history: AIHistoryEntry[] = [],
    bestAgency: number = 0,
    bestControl: ControlSignal | null = null,
    _savedAgents: LibraryEntry[] = []
): Promise<{ u: number; reasoning: string; params?: any; error?: string } | null> => {
    void _savedAgents;
    if (typeof window === 'undefined') {
        return { error: 'Window not defined (SSR?)', u: control.U, reasoning: '' };
    }

    const win = window as any;
    if (!win.api || !win.api.requestAIControl) {
        console.warn('[AI Service] IPC bridge not available.');
        return { error: 'IPC bridge not available', u: control.U, reasoning: '' };
    }

    try {
        const response = await win.api.requestAIControl({
            state,
            currentParams,
            control,
            scenarioMetadata,
            history,
            bestAgency,
            bestControl
        });

        if (!response?.success) {
            console.warn('[AI Service] AI control request failed:', response?.error);
            return { error: response?.error || 'Unknown IPC error', u: control.U, reasoning: '' };
        }

        if (!response.data || !validateAiControlResponsePayload(response.data)) {
            console.warn('[AI Service] Invalid AI control response payload.');
            return { error: 'Invalid response from AI service', u: control.U, reasoning: '' };
        }

        return response.data;
    } catch (e: any) {
        return { error: e.message || 'Exception during AI request', u: control.U, reasoning: '' };
    }
};

export const generateAgentDescription = async (
    agentData: Omit<LegacyAgent, 'name' | 'description' | 'tags'>
): Promise<AiDescriptionResponsePayload | null> => {
    if (typeof window === 'undefined') {
        return null;
    }

    const win = window as any;
    if (!win.api || !win.api.generateAgentDescription) {
        return {
            name: `Agent-${agentData.id.substring(0, 6)}`,
            description: "AI IPC bridge missing. Auto-generated placeholder description.",
            tags: ["High-Agency", "Manual"],
            cognitiveHorizon: 0,
            competency: 0
        };
    }

    try {
        const response = await win.api.generateAgentDescription({ agentData });
        if (!response?.success || !response.data) {
            return {
                name: `Agent-${agentData.id.substring(0, 8)}`,
                description: "Failed to generate AI description. See console for error.",
                tags: ["Error"],
                cognitiveHorizon: 0,
                competency: 0
            };
        }

        if (!validateAiDescriptionResponsePayload(response.data)) {
            console.warn('[AI Service] Invalid AI description payload received:', response.data);
            return {
                name: `Agent-${agentData.id.substring(0, 8)}`,
                description: "Invalid AI description payload.",
                tags: ["Error"],
                cognitiveHorizon: 0,
                competency: 0
            };
        }

        return response.data;
    } catch (e) {
        console.error('[AI Service] Exception during agent description generation:', e);
        return {
            name: `Agent-${agentData.id.substring(0, 8)}`,
            description: "Exception during generation.",
            tags: ["Error"],
            cognitiveHorizon: 0,
            competency: 0
        };
    }
};
