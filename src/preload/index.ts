import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
    // Expose logAIAction for persistent logging
    logAIAction: (data: any) => ipcRenderer.invoke('log-ai-action', data),
    // Expose openLogsFolder
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),

    // Agent Library API
    saveAgent: (agent: any) => ipcRenderer.invoke('save-agent', agent),
    getAgents: () => ipcRenderer.invoke('get-agents'),
    deleteAgent: (id: string) => ipcRenderer.invoke('delete-agent', id)
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
