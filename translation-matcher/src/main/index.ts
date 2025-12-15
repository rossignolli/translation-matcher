import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { fileSystemService } from './services/filesystem.service'
import { openAIService } from './services/openai.service'
import { pipelineService } from './services/pipeline.service'
import { dbService } from './services/database.service'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // File System IPC
  ipcMain.handle('fs:pick-file', async (_, type: 'file' | 'folder') => {
    return await fileSystemService.openFileDialog(type);
  });

  ipcMain.handle('fs:read-excel', (_, filePath: string) => {
    return fileSystemService.readManifest(filePath);
  });

  ipcMain.handle('fs:save-file', async (_, { content, defaultName, extensions }) => {
    return await fileSystemService.saveFile(content, defaultName, extensions);
  });

  // AI IPC
  ipcMain.handle('ai:test-connection', async (_, apiKey: string) => {
    openAIService.initialize(apiKey);
    return await openAIService.testConnection();
  });

  // Pipeline IPC
  ipcMain.handle('pipeline:start', (_, config) => {
    // Run in background, don't await the whole thing here
    pipelineService.startPipeline(config);
    return true;
  });

  ipcMain.handle('pipeline:stop', () => {
    // Implement stop flag in service
    // pipelineService.stop(); // TODO: Add public stop method if needed, currently isRunning flag handles graceful exit naturally? 
    // Actually, force stop logic might be needed.
    return true;
  });

  // Results IPC
  ipcMain.handle('results:get', () => {
    return dbService.getDb().prepare(`
      SELECT 
        m.*, 
        dA.filename as a_filename, 
        dB.filename as b_filename 
      FROM matches m
      JOIN documents dA ON m.doc_a_id = dA.id
      JOIN documents dB ON m.doc_b_id = dB.id
      ORDER BY m.confidence DESC
    `).all();
  });

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
