// Module to create native browser windows
import { BrowserWindow } from 'electron'
import { format as formatUrl } from 'url'
import path from 'path'

const isDevelopment = process.env.NODE_ENV !== 'production'

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow

import defaultConfiguration from '../common/default_config.json'
import customConfiguration from '../../config.json'
const globalConfiguration = { ...defaultConfiguration, ...customConfiguration }

export function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    title: globalConfiguration['app_name'],
    webPreferences:
      process.env.NODE_ENV === 'development'
        ? { nodeIntegration: true }
        : {
            // TODO(theis): fix this, should not enable nodeIntegration!
            // check: https://www.electronjs.org/docs/tutorial/security
            // and https://github.com/doyensec/electronegativity
            nodeIntegration: true,
            // preload: path.join(__dirname, 'renderer.prod.js')
          },
  })

  if (isDevelopment) {
    mainWindow.loadURL(
      `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`
    )
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL(
      formatUrl({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file',
        slashes: true,
      })
    )
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.focus()
    setImmediate(() => {
      mainWindow.focus()
    })
  })
}

export function existsWindow(): boolean {
  return mainWindow !== null
}

// send a message to the main Renderer window over IPC
export function send(channel: string, ...args: unknown[]): void {
  mainWindow.webContents.send(channel, ...args)
}
