import log from 'loglevel'

const VITE_COMPILE_ELECTRON: boolean =
  import.meta.env.VITE_COMPILE_ELECTRON != undefined

export async function setBackgroundColorElectron(
  backgroundColor: string
): Promise<void> {
  if (VITE_COMPILE_ELECTRON) {
    log.debug('Request window background color update')
    window.ipcRenderer.send('set-background-color', backgroundColor)
  }
}

export async function getTitleBarDisplay(): Promise<string | null> {
  if (VITE_COMPILE_ELECTRON) {
    return <Promise<string>>window.ipcRenderer.invoke('get-titleBarStyle')
  } else {
    return null
  }
}

export async function toggleMaximizeWindowElectron(): Promise<void> {
  if (VITE_COMPILE_ELECTRON) {
    log.debug('Requesting window.maximize toggle')
    window.ipcRenderer.send('window-toggle-maximize')
  }
}
