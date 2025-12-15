import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      pickFile: (type: 'file' | 'folder') => Promise<string | null>
      readExcel: (filePath: string) => Promise<any[]>
      saveFile: (content: string, defaultName: string, extensions: string[]) => Promise<boolean>
      testAI: (apiKey: string) => Promise<boolean>
      startPipeline: (config: any) => Promise<boolean>
      onLog: (callback: (msg: string) => void) => void
      getResults: () => Promise<any[]>
    }
  }
}
