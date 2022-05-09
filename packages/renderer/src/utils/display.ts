import log from 'loglevel'

const VITE_COMPILE_ELECTRON: boolean =
  import.meta.env.VITE_COMPILE_ELECTRON != undefined

export async function setBackgroundColorElectron(
  backgroundColor: string
): Promise<void> {
  if (VITE_COMPILE_ELECTRON) {
    log.debug('Request window background color update')
    window.ipcRendererInterface.setBackgroundColor(backgroundColor)
  }
}

export async function getTitleBarDisplay(): Promise<string | null> {
  if (VITE_COMPILE_ELECTRON) {
    return window.ipcRendererInterface.getTitleBarStyle()
  } else {
    return null
  }
}

export async function toggleMaximizeWindowElectron(): Promise<void> {
  if (VITE_COMPILE_ELECTRON) {
    log.debug('Requesting window.maximize toggle')
    window.ipcRendererInterface.toggleWindowMaximize()
  }
}
