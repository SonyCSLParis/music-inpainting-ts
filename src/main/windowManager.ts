// Module to create native browser window
import {BrowserWindow} from 'electron'
import { format as formatUrl } from 'url'
import * as path from 'path';

const isDevelopment = process.env.NODE_ENV !== 'production'

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow;

export function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow()

  if (isDevelopment) {
    mainWindow.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  }
  else {
    mainWindow.loadURL(formatUrl({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file',
      slashes: true
    }))
  }
  // TODO(theis) Remove this!
  mainWindow.webContents.openDevTools()

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
export function send(channel: string, ...args: any[]) {
    mainWindow.webContents.send(channel, ...args)
}
