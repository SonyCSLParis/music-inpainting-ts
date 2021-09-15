// Module to create native browser windows
import { BrowserWindow } from 'electron'
import path from 'path'
import { LinkServerElectron } from './ableton_link/linkServer.electron'

const isDevelopment = process.env.NODE_ENV !== 'production'

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
// let mainWindow: BrowserWindow | null = null
const openWindows = new Map<number, BrowserWindow>()

import defaultConfiguration from '../common/default_config.json'
import customConfiguration from '../../config.json'
const globalConfiguration = { ...defaultConfiguration, ...customConfiguration }

export function createWindow(): void {
  // Create the browser window
  const window = new BrowserWindow({
    title: globalConfiguration['app_name'],
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
  })
  const linkServer = new LinkServerElectron(window, 120, 4, false)

  if (isDevelopment) {
    const electronWebpackWebDevelopmentServerPort =
      process.env.ELECTRON_WEBPACK_WDS_PORT
    if (electronWebpackWebDevelopmentServerPort != undefined) {
      void window.loadURL(
        'http://localhost:' + electronWebpackWebDevelopmentServerPort
      )
    }
  } else {
    void window.loadURL('file://' + path.join(__dirname, 'index.html'))
  }

  const windowID = window.id
  function onWindowClosed() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    linkServer.disable()
    openWindows.delete(windowID)
  }
  window.on('closed', onWindowClosed)
  window.on('close', onWindowClosed)

  window.webContents.on('devtools-opened', () => {
    if (window != null) {
      window.focus()
      setImmediate(() => {
        if (window != null) {
          window.focus()
        }
      })
    }
  })

  openWindows.set(windowID, window)
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
