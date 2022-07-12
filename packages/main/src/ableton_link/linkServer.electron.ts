import { BrowserWindow, ipcMain } from 'electron'
import log from 'loglevel'
import { LinkServer } from './linkServer'

import default_config from '../../../common/default_config.json'

export class LinkServerElectron extends LinkServer<BrowserWindow> {
  removeTarget(windowId: number) {
    this.communicationTargets.delete(windowId)
  }
  protected static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  protected async isEnabled(window: BrowserWindow): Promise<boolean> {
    const isEnabled = new Promise<boolean>(async (resolve) => {
      const listener = () => {
        log.debug(`Window: ${window.id}: currently enabled!`)
        resolve(true)
      }
      log.debug(`Window: ${window.id}: Register resolve callback`)
      ipcMain.once(this.prefixMessage('enabled', window), listener)
      await LinkServerElectron.delay(1000)
      log.debug(`Window: ${window.id}: Timeout, no answer`)
      ipcMain.removeListener(this.prefixMessage('enabled', window), listener)
      resolve(false)
    })
    window.webContents.send(this.prefixMessage('is-enabled'))
    return isEnabled
  }
  protected targetToId(window: BrowserWindow): number {
    return window.id
  }

  static downbeatUpdateRate_ms = 10
  constructor(bpm?: number, quantum?: number, enable?: boolean) {
    super(bpm, quantum, enable)
  }

  protected prefixMessage(message: string, window?: BrowserWindow): string {
    return (
      super.prefixMessage(message) +
      (window != null ? `/window-${window.id.toString()}/` : '')
    )
  }
  protected sendToClient(
    communicationTarget: BrowserWindow,
    message: string,
    ...args: any[]
  ): void {
    communicationTarget.webContents.send(message, ...args)
  }

  attachListeners(): void {
    ipcMain.on(this.prefixMessage('ping'), (event) => {
      event.reply(this.prefixMessage('pong'))
      event.reply(this.prefixMessage('initialized-status'), true)
      event.reply(this.prefixMessage('enabled-status'), this.linkEnable)
      log.debug('Received ping!')
    })

    // Update LINK on tempo changes coming from the client
    ipcMain.on(this.prefixMessage('set-bpm'), (_, newBPM: number) => {
      // HACK perform a comparison to avoid messaging loops, since
      // the link update triggers a BPM modification message
      // from main to renderer
      if (this.linkEnable && this.bpm !== newBPM) {
        const previous_link_bpm = this.bpm
        this.bpm = newBPM

        log.debug('LINK: Triggered LINK tempo update:')
        log.debug(`\tBefore: ${previous_link_bpm}, now: ${newBPM}`)
      }
    })

    // Enable LINK and start a downbeat clock to synchronize Transport
    ipcMain.on(this.prefixMessage('enable'), async (event) => {
      if (!this.linkEnable) {
        await this.enable() // enable backend LINK-server
      }
      event.reply(this.prefixMessage('link-enabled-success'))
    })

    // Disable LINK
    ipcMain.on(this.prefixMessage('disable'), async (event) => {
      await this.disable()
      event.reply(this.prefixMessage('link-disabled'))
    })

    // Accessor for retrieving the current LINK tempo
    ipcMain.on(this.prefixMessage('get-tempo'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('tempo'), this.bpm)
      }
    })
    ipcMain.on(this.prefixMessage('set-tempo'), (event, newBpm: number) => {
      if (this.linkEnable) {
        this.bpm = newBpm
      }
    })
    ipcMain.on(this.prefixMessage('get-quantum'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('quantum'), this.quantum)
      }
    })
    ipcMain.on(this.prefixMessage('set-quantum'), (event, quantum: number) => {
      if (this.linkEnable) {
        this.quantum = quantum
      }
    })

    ipcMain.on(this.prefixMessage('get-phase'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('phase'), this.phase)
      }
    })

    ipcMain.on(this.prefixMessage('get-play-state'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('play-state'), this.playState)
      }
    })

    ipcMain.on(this.prefixMessage('kill'), () => this.disable())
  }
}
