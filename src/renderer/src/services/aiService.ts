import { SimulationState, SimulationParameters, ControlSignal, AIHistoryEntry, ScenarioMetadata } from '../simulation/types';
import { LibraryEntry, LegacyAgent } from '../../../shared/agentLibrary';
import {
    validateAiControlResponsePayload,
    validateAiDescriptionResponsePayload,
    AiDescriptionResponsePayload,
    AiServiceErrorPayload
} from '../../../shared/ipcValidation';

export const fetchAIControl = async (
    state: SimulationState,
    currentParams: SimulationParameters,
    control: ControlSignal,
    scenarioMetadata: ScenarioMetadata,
    history: AIHistoryEntry[] = [],
    bestAgency: number = 0,
    bestControl: ControlSignal | null = null,
    _savedAgents: LibraryEntry[] = []
): Promise<{ u: number; reasoning: string; params?: any; error?: string; errorDetails?: AiServiceErrorPayload } | null> => {
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
            const message = typeof response?.error === 'string' ? response.error : response?.error?.message;
            return {
                error: message || 'Unknown IPC error',
                errorDetails: typeof response?.error === 'object' ? response.error : undefined,
                u: control.U,
                reasoning: ''
            };
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
        return null;
    }

    try {
        const response = await win.api.generateAgentDescription({ agentData });
        if (!response?.success || !response.data) {
            return null;
        }

        if (!validateAiDescriptionResponsePayload(response.data)) {
            console.warn('[AI Service] Invalid AI description payload received:', response.data);
            return null;
        }

        return response.data;
    } catch (e) {
        console.error('[AI Service] Exception during agent description generation:', e);
        return null;
    }
};
