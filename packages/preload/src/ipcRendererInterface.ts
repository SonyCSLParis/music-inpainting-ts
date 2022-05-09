import { ipcRenderer } from 'electron'
import { exposeInMainWorld } from './exposeInMainWorld'

export const ipcRendererInterface = {
  getPath(fileName: string, appDirectory: 'documents' | 'temp') {
    return ipcRenderer.invoke('get-path', fileName, appDirectory)
  },

  saveFile(fileName: string, buffer: Buffer): Promise<void> {
    return ipcRenderer.invoke('save-file', fileName, buffer)
  },

  startDrag(filePath: string, iconPath: string): void {
    ipcRenderer.send('start-drag', filePath, iconPath)
  },

  setBackgroundColor(backgroundColor: string): void {
    ipcRenderer.send('set-background-color', backgroundColor)
  },

  getTitleBarStyle(): Promise<string> {
    return ipcRenderer.invoke('get-titleBarStyle')
  },

  toggleWindowMaximize(): void {
    ipcRenderer.send('window-toggle-maximize')
  },

  getWindowId(): Promise<number> {
    return ipcRenderer.invoke('get-window-id')
  },
}
// export const ipcRendererInterface = new IpcRendererInterface()
exposeInMainWorld('ipcRendererInterface', ipcRendererInterface)
