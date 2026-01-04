import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

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
    try {
        const userDataPath = app.getPath('userData')
        const logsDir = join(userDataPath, 'logs')
        const logFile = join(logsDir, 'ai_log.csv')

        // Ensure directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true })
        }

        // Create header if file doesn't exist
        if (!fs.existsSync(logFile)) {
            const header = 'Timestamp,Generation,Action,U,Parameters,Reasoning,Agency,BestAgency\n'
            fs.writeFileSync(logFile, header, 'utf8')
        }

        // Format CSV row (handling commas in reasoning by quoting)
        const timestamp = new Date().toISOString()
        // Escape quotes in strings
        const safeReasoning = `"${(data.reasoning || '').replace(/"/g, '""')}"`
        const safeAction = `"${(data.action || '').replace(/"/g, '""')}"`
        const safeParams = `"${(JSON.stringify(data.params || {})).replace(/"/g, '""')}"`

        const row = `${timestamp},${data.generation},${safeAction},${data.u},${safeParams},${safeReasoning},${data.agency},${data.bestAgency}\n`

        fs.appendFileSync(logFile, row, 'utf8')
        return { success: true, path: logFile }
    } catch (error) {
        console.error('Failed to log AI action:', error)
        return { success: false, error: String(error) }
    }
})

// IPC Handler to Open Logs Folder
ipcMain.handle('open-logs-folder', async () => {
    const userDataPath = app.getPath('userData')
    const logsDir = join(userDataPath, 'logs')
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
    }
    await shell.openPath(logsDir)
    return { success: true }
})

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
