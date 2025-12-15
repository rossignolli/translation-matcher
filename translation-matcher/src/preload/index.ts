import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  pickFile: (type: 'file' | 'folder') => ipcRenderer.invoke('fs:pick-file', type),
  readExcel: (filePath: string) => ipcRenderer.invoke('fs:read-excel', filePath),
  saveFile: (content: string, defaultName: string, extensions: string[]) => ipcRenderer.invoke('fs:save-file', { content, defaultName, extensions }),
  testAI: (apiKey: string) => ipcRenderer.invoke('ai:test-connection', apiKey),
  startPipeline: (config: any) => ipcRenderer.invoke('pipeline:start', config),
  onLog: (callback: (msg: string) => void) => ipcRenderer.on('pipeline:log', (_, msg) => callback(msg)),
  getResults: () => ipcRenderer.invoke('results:get')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
