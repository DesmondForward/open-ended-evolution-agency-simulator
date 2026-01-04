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

// --- Agent Library IPC Handlers ---

ipcMain.handle('save-agent', async (_, agentData) => {
    try {
        const userDataPath = app.getPath('userData')
        const libraryDir = join(userDataPath, 'library', 'agents')

        // Ensure directory exists
        if (!fs.existsSync(libraryDir)) {
            fs.mkdirSync(libraryDir, { recursive: true })
        }

        const safeId = agentData.id.replace(/[^a-z0-9-]/gi, '_')
        const filename = `agent_${safeId}.json`
        const filePath = join(libraryDir, filename)

        fs.writeFileSync(filePath, JSON.stringify(agentData, null, 2), 'utf8')
        return { success: true, path: filePath }
    } catch (error) {
        console.error('Failed to save agent:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('get-agents', async () => {
    try {
        const userDataPath = app.getPath('userData')
        const libraryDir = join(userDataPath, 'library', 'agents')

        if (!fs.existsSync(libraryDir)) {
            return []
        }

        const files = fs.readdirSync(libraryDir).filter(f => f.endsWith('.json'))
        const agents = files.map(file => {
            try {
                const content = fs.readFileSync(join(libraryDir, file), 'utf8')
                return JSON.parse(content)
            } catch (e) {
                console.error(`Failed to read agent file ${file}:`, e)
                return null
            }
        }).filter(a => a !== null)

        // Sort by timestamp descending
        agents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        return agents
    } catch (error) {
        console.error('Failed to get agents:', error)
        return []
    }
})

ipcMain.handle('delete-agent', async (_, id) => {
    try {
        const userDataPath = app.getPath('userData')
        const libraryDir = join(userDataPath, 'library', 'agents')
        const safeId = id.replace(/[^a-z0-9-]/gi, '_')
        const filename = `agent_${safeId}.json`
        const filePath = join(libraryDir, filename)

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            return { success: true }
        }
        return { success: false, error: 'File not found' }
    } catch (error) {
        return { success: false, error: String(error) }
    }
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
