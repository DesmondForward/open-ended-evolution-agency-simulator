import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
    interface Window {
        electron: ElectronAPI
        api: {
            logAIAction: (data: any) => Promise<{ success: boolean; path?: string; error?: string }>
            openLogsFolder: () => Promise<{ success: boolean }>
        }
    }
}
