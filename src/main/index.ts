import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { appendAiLogEntry } from './storage/aiLogStorage'
import { deleteAgentFromLibrary, getAgentsFromLibrary, saveAgentToLibrary, summonAgentsFromLibrary } from './storage/agentLibraryStorage'
import {
    validateAiControlRequestPayload,
    validateAiDescriptionRequestPayload,
    validateAiLogPayload,
    validateDeleteAgentPayload,
    validateSaveAgentPayload,
    validateSaveErdosReportPayload,
    validateSummonAgentPayload
} from '../shared/ipcValidation'
import { requestAiControl, requestAgentDescription } from './aiService'
import { saveErdosReport } from './storage/erdosReportStorage'

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#0a0a1a',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// IPC Handler for AI Logging
ipcMain.handle('log-ai-action', async (_, data) => {
    if (!validateAiLogPayload(data)) {
        return { success: false, error: 'Invalid payload for AI log.' }
    }
    const userDataPath = app.getPath('userData')
    const result = appendAiLogEntry(userDataPath, data)
    if (!result.success) {
        console.error('Failed to log AI action:', result.error)
    }
    return result
})

// IPC Handler to Open Logs Folder
ipcMain.handle('open-logs-folder', async () => {
    const userDataPath = app.getPath('userData')
    const logsDir = join(userDataPath, 'logs')
    if (!logsDir) {
        return { success: false, error: 'User data path not available.' }
    }
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
    }
    await shell.openPath(logsDir)
    return { success: true }
})

// --- Agent Library IPC Handlers ---

ipcMain.handle('save-agent', async (_, agentData) => {
    if (!validateSaveAgentPayload(agentData)) {
        return { success: false, error: 'Invalid agent payload.' }
    }
    const userDataPath = app.getPath('userData')
    const result = saveAgentToLibrary(userDataPath, agentData as unknown as Record<string, unknown>)
    if (!result.success) {
        console.error('Failed to save agent:', result.error)
    }
    return result
})

ipcMain.handle('get-agents', async () => {
    const userDataPath = app.getPath('userData')
    return getAgentsFromLibrary(userDataPath)
})

ipcMain.handle('delete-agent', async (_, id) => {
    if (!validateDeleteAgentPayload({ id })) {
        return { success: false, error: 'Invalid agent id.' }
    }
    const userDataPath = app.getPath('userData')
    return deleteAgentFromLibrary(userDataPath, id)
})



ipcMain.handle('save-erdos-report', async (_, payload) => {
    if (!validateSaveErdosReportPayload(payload)) {
        return { success: false, error: 'Invalid Erdos report payload.' }
    }
    const userDataPath = app.getPath('userData')
    const result = saveErdosReport(userDataPath, payload)
    if (!result.success) {
        console.error('Failed to save Erdos report:', result.error)
    }
    return result
})

ipcMain.handle('summon-agent', async (_, payload) => {
    if (!validateSummonAgentPayload(payload)) {
        return { success: false, error: 'Invalid summon payload.' }
    }
    const userDataPath = app.getPath('userData')
    const matches = summonAgentsFromLibrary(userDataPath, payload)
    return { success: true, data: matches }
})

let aiQueue: Promise<void> = Promise.resolve();
const enqueueAi = async <T>(task: () => Promise<T>): Promise<T> => {
    const run = aiQueue.then(task, task);
    aiQueue = run.then(() => undefined, () => undefined);
    return run;
};

ipcMain.handle('ai-control-request', async (_, payload) => {
    if (!validateAiControlRequestPayload(payload)) {
        return { success: false, error: 'Invalid AI control payload.' }
    }
    try {
        const result = await enqueueAi(() => requestAiControl(payload));
        if (!result) {
            // This case might be unreachable now if requestAiControl always throws or returns non-null, but keeping for safety
            return { success: false, error: 'AI control request failed silently.' }
        }
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown AI error' };
    }
});

ipcMain.handle('ai-agent-description', async (_, payload) => {
    if (!validateAiDescriptionRequestPayload(payload)) {
        return { success: false, error: 'Invalid AI description payload.' }
    }
    const result = await enqueueAi(() => requestAgentDescription(payload));
    if (!result) {
        return { success: false, error: 'AI description request failed.' }
    }
    return { success: true, data: result };
});

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.evolution.simulator')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
