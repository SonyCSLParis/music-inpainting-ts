import log from 'loglevel'

declare const COMPILE_ELECTRON: boolean

export async function setBackgroundColorElectron(
  backgroundColor: string
): Promise<void> {
  if (COMPILE_ELECTRON) {
    const ipcRenderer = (await import('electron')).ipcRenderer
    log.debug('Request window background color update')
    ipcRenderer.send('set-background-color', backgroundColor)
  }
}

export async function getTitleBarDisplay(): Promise<string | null> {
  if (COMPILE_ELECTRON) {
    const ipcRenderer = (await import('electron')).ipcRenderer
    return <Promise<string>>ipcRenderer.invoke('get-titleBarStyle')
  } else {
    return null
  }
}

export async function toggleMaximizeWindowElectron(): Promise<void> {
  if (COMPILE_ELECTRON) {
    const ipcRenderer = (await import('electron')).ipcRenderer
    log.debug('Requesting window.maximize toggle')
    ipcRenderer.send('window-toggle-maximize')
  }
}
