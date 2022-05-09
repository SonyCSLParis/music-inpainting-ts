// Modules to control application life
import { app, ipcMain } from 'electron'
app.commandLine.appendSwitch('disable-pinch')
import log from 'loglevel'
import path from 'path'
import { outputFile } from 'fs-extra'

import * as WindowManager from './windowManager'

const isDevelopment = process.env.NODE_ENV !== 'production'

if (isDevelopment) {
  log.setLevel(log.levels.DEBUG)
  log.debug('Enabled DEBUG logs from main process')
} else {
  log.setLevel(log.levels.INFO)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', WindowManager.createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  WindowManager.createWindow()
})

ipcMain.handle(
  'get-path',
  (event, fileName, appDirectory: 'documents' | 'temp') => {
    const storagePath = path.join(
      app.getPath(appDirectory),
      'NONOTO_generations',
      fileName
    )
    return storagePath
  }
)

ipcMain.handle('save-file', async (event, fileName: string, buffer: Buffer) => {
  return outputFile(fileName, buffer)
})

ipcMain.on('start-drag', (event, filePath: string, iconPath: string) => {
  event.sender.startDrag({
    file: filePath,
    icon: iconPath,
  })
})

ipcMain.handle('get-window-id', (event) => {
  return event.sender.id
})
