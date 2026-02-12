import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
    interface Window {
        electron: ElectronAPI
        api: {
            logAIAction: (data: any) => Promise<{ success: boolean; path?: string; error?: string }>
            openLogsFolder: () => Promise<{ success: boolean; error?: string }>
            saveAgent: (agent: any) => Promise<{ success: boolean; path?: string; error?: string }>
            getAgents: () => Promise<any[]>
            deleteAgent: (id: string) => Promise<{ success: boolean; error?: string }>
            requestAIControl: (payload: any) => Promise<{ success: boolean; data?: { u: number; reasoning: string; params?: Record<string, unknown> }; error?: string }>
            generateAgentDescription: (payload: any) => Promise<{ success: boolean; data?: { name: string; description: string; tags: string[] }; error?: string }>
        }
    }
}
