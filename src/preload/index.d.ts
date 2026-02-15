import { ElectronAPI } from '@electron-toolkit/preload'
import { LibraryEntry } from '../shared/agentLibrary'
import { AiServiceErrorPayload } from '../shared/ipcValidation'

declare global {
    interface Window {
        electron: ElectronAPI
        api: {
            logAIAction: (data: any) => Promise<{ success: boolean; path?: string; error?: string }>
            openLogsFolder: () => Promise<{ success: boolean; error?: string }>
            saveAgent: (agent: LibraryEntry) => Promise<{ success: boolean; path?: string; error?: string }>
            saveErdosReport: (payload: { problemId: string; erdosNumber?: number; title: string; markdown: string; datasetRevision: string; evaluatorStatus: 'verified' | 'refuted' | 'inconclusive'; evaluatorArtifactId: string; evidenceReferences: string[] }) => Promise<{ success: boolean; path?: string; error?: string }>
            getAgents: () => Promise<LibraryEntry[]>
            deleteAgent: (id: string) => Promise<{ success: boolean; error?: string }>
            summonAgent: (payload: { query: string; topK?: number; preferredAdapter?: 'python' | 'http' | 'cli' | 'native' }) => Promise<{ success: boolean; data?: Array<{ score: number; rationale: string[]; entry: LibraryEntry; summonPlan: { adapterType: string; entrypoint: string; invocation: string } }>; error?: string }>
            requestAIControl: (payload: any) => Promise<{ success: boolean; data?: { u: number; reasoning: string; params?: Record<string, unknown> }; error?: string | AiServiceErrorPayload }>
            generateAgentDescription: (payload: any) => Promise<{ success: boolean; data?: { name: string; description: string; tags: string[]; cognitiveHorizon: number; competency: number }; error?: string | AiServiceErrorPayload }>
        }
    }
}
