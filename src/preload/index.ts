import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
    validateAiControlRequestPayload,
    validateAiDescriptionRequestPayload,
    validateAiLogPayload,
    validateDeleteAgentPayload,
    validateSaveAgentPayload,
    validateSummonAgentPayload
} from '../shared/ipcValidation'

const allowedInvokeChannels = new Set([
    'log-ai-action',
    'open-logs-folder',
    'save-agent',
    'get-agents',
    'delete-agent',
    'summon-agent',
    'ai-control-request',
    'ai-agent-description'
]);

const invokeAllowed = (channel: string, payload?: any) => {
    if (!allowedInvokeChannels.has(channel)) {
        throw new Error(`Blocked IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
};

const api = {
    // Expose logAIAction for persistent logging
    logAIAction: (data: any) => {
        if (!validateAiLogPayload(data)) {
            return Promise.resolve({ success: false, error: 'Invalid AI log payload.' });
        }
        return invokeAllowed('log-ai-action', data);
    },
    // Expose openLogsFolder
    openLogsFolder: () => invokeAllowed('open-logs-folder'),

    // Agent Library API
    saveAgent: (agent: any) => {
        if (!validateSaveAgentPayload(agent)) {
            return Promise.resolve({ success: false, error: 'Invalid agent payload.' });
        }
        return invokeAllowed('save-agent', agent);
    },
    getAgents: () => invokeAllowed('get-agents'),
    deleteAgent: (id: string) => {
        if (!validateDeleteAgentPayload({ id })) {
            return Promise.resolve({ success: false, error: 'Invalid agent id.' });
        }
        return invokeAllowed('delete-agent', id);
    },
    summonAgent: (payload: any) => {
        if (!validateSummonAgentPayload(payload)) {
            return Promise.resolve({ success: false, error: 'Invalid summon payload.' });
        }
        return invokeAllowed('summon-agent', payload);
    },
    requestAIControl: (payload: any) => {
        if (!validateAiControlRequestPayload(payload)) {
            return Promise.resolve({ success: false, error: 'Invalid AI control payload.' });
        }
        return invokeAllowed('ai-control-request', payload);
    },
    generateAgentDescription: (payload: any) => {
        if (!validateAiDescriptionRequestPayload(payload)) {
            return Promise.resolve({ success: false, error: 'Invalid AI description payload.' });
        }
        return invokeAllowed('ai-agent-description', payload);
    }
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}
