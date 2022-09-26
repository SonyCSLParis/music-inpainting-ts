// Module to create native browser windows
import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import log from 'loglevel'
import type { LinkServerElectron } from './ableton_link/linkServer.electron'

const VITE_INTEGRATE_ABLETON_LINK =
  import.meta.env.VITE_INTEGRATE_ABLETON_LINK != undefined

log.info(
  'Env variable VITE_INTEGRATE_ABLETON_LINK is ',
  VITE_INTEGRATE_ABLETON_LINK
)

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const openWindows = new Map<number, BrowserWindow>()

import defaultConfiguration from '../../common/default_config.json'
import customConfiguration from '../../../config.json'
const globalConfiguration = { ...defaultConfiguration, ...customConfiguration }

// FIXME(@tbazin, 2021/10/28): avoid using a global like this
const TITLE_BAR_STYLE = 'hiddenInset'

let linkServer: LinkServerElectron | null = null

if (VITE_INTEGRATE_ABLETON_LINK) {
  import('./ableton_link/linkServer.electron').then(
    (linkServerElectronModule) => {
      linkServer = new linkServerElectronModule.LinkServerElectron(
        120,
        4,
        false
      )
    }
  )
  log.debug('Initialized global linkServer')
}

export async function createWindow(): Promise<void> {
  // Create the browser window
  const browserWindow = new BrowserWindow({
    title: globalConfiguration['app_name'],
    minWidth: 450,
    minHeight: 450,
    // FIXME(@tbazin, 2021/10/22): hardcoded value
    backgroundColor: 'black',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // prevent window from getting decreased performance when not focused,
      // which would lead to unstable audio playback
      backgroundThrottling: false,
      preload: path.join(__dirname, '../../preload/dist/index.cjs'),
    },
    titleBarStyle: TITLE_BAR_STYLE,
  })

  linkServer?.registerTarget(browserWindow)

  const pageUrl =
    import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? import.meta.env.VITE_DEV_SERVER_URL
      : new URL('../renderer/dist/index.html', 'file://' + __dirname).toString()

  await browserWindow.loadURL(pageUrl)

  const windowID = browserWindow.id
  // inject windowId into renderer process to allow filtering ipcRenderer
  // communications by window
  await browserWindow.webContents.executeJavaScript(
    `window.electronWindowId = ${windowID}`
  )

  function onWindowClosed() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    linkServer?.removeTarget(windowID)
    openWindows.delete(windowID)
  }
  browserWindow.on('closed', onWindowClosed)
  browserWindow.on('close', onWindowClosed)

  browserWindow.webContents.on('devtools-opened', () => {
    if (browserWindow != null) {
      //test
      browserWindow.focus()
      setImmediate(() => {
        if (browserWindow != null) {
          browserWindow.focus()
        }
      })
    }
  })

  openWindows.set(windowID, browserWindow)

  // Force exit mode for html5 fullscreen api
  browserWindow.on('leave-full-screen', (event) => {
    if (document != undefined) {
      document.webkitExitFullscreen()
    }
  })
}

export function existsWindow(): boolean {
  return openWindows.size > 0
}

// send a message to the main Renderer window over IPC
export function send(channel: string, ...args: unknown[]): void {
  const mainWindow = Array.from(openWindows.values())[0]
  mainWindow.webContents.send(channel, ...args)
}

// send a message to the all Renderer windows over IPC
export function broadcast(channel: string, ...args: unknown[]): void {
  openWindows.forEach((window) => window.webContents.send(channel, ...args))
}

ipcMain.on('window-toggle-maximize', (event) => {
  const id = event.sender.id
  const targetWindow = openWindows.get(id)
  if (targetWindow) {
    log.debug(`Window: ${id}: toggling window maximization state`)
    targetWindow.isMaximized()
      ? targetWindow.unmaximize()
      : targetWindow.maximize()
  }
})

ipcMain.on('set-background-color', (event, backgroundColor: string) => {
  log.debug(`Requested setting background color to ${backgroundColor}`)
  const id = event.sender.id
  const targetWindow = openWindows.get(id)
  if (targetWindow) {
    targetWindow.setBackgroundColor(backgroundColor)
    log.debug(`Window: ${id}: set background color to ${backgroundColor}`)
  }
})

ipcMain.handle('get-titleBarStyle', () => {
  return TITLE_BAR_STYLE
})
