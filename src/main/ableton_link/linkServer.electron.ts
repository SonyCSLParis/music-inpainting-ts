import { BrowserWindow, ipcMain } from 'electron'
import log from 'loglevel'
import AbletonLink from 'abletonlink'

import default_config from '../../common/default_config.json'
const link_channel_prefix: string = default_config['link_channel_prefix']

export class LinkServerElectron extends AbletonLink {
  protected readonly window: BrowserWindow

  static downbeatUpdateRate_ms = 16
  constructor(
    window: BrowserWindow,
    bpm?: number,
    quantum?: number,
    enable?: boolean
  ) {
    super(bpm, quantum, enable)
    this.window = window

    this.init()
    this.attachListeners()
    this.startDownbeatClock()
  }

  protected prefixMessage(message: string): string {
    return link_channel_prefix + this.window.id.toString() + message
  }

  init(): void {
    // TODO(theis): how to detect errors in initialization?
    this.on('tempo', (bpm: number) => {
      log.info('LINK: BPM changed, now ' + bpm.toString())
      this.window.webContents.send(this.prefixMessage('bpm'), bpm)
    })
    this.on('numPeers', (numPeers: number) => {
      log.info('LINK: numPeers changed, now ' + numPeers.toString())
      this.window.webContents.send(this.prefixMessage('numPeers'), numPeers)
    })

    ipcMain.emit(this.prefixMessage('initialized-status'), true)
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
        console.log(newBPM)
        this.bpm = newBPM

        log.debug('LINK: Triggered LINK tempo update:')
        log.debug(`\tBefore: ${previous_link_bpm}, now: ${newBPM}`)
      }
    })

    // Enable LINK and start a downbeat clock to synchronize Transport
    ipcMain.on(this.prefixMessage('enable'), (event) => {
      if (!this.linkEnable) {
        this.enable() // enable backend LINK-server
      }
      event.reply(this.prefixMessage('link-enabled-success'))
    })

    // Disable LINK
    ipcMain.on(this.prefixMessage('disable'), (event) => {
      this.disable()
      event.reply(this.prefixMessage('link-disabled'))
    })

    // Accessor for retrieving the current LINK tempo
    ipcMain.on(this.prefixMessage('get-bpm'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('bpm'), this.bpm)
      }
    })
    ipcMain.on(this.prefixMessage('get-quantum'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('quantum'), this.quantum)
      }
    })

    ipcMain.on(this.prefixMessage('get-phase'), (event) => {
      if (this.linkEnable) {
        event.reply(this.prefixMessage('phase'), this.phase)
      }
    })

    ipcMain.on(this.prefixMessage('kill'), () => this.disable())
  }

  startDownbeatClock(): void {
    // log.warn('downbeatClock disabled')
    // return
    // Start a LINK-based downbeat clock using IPC messages
    // updateRate_ms, number: interval (in ms) between updates in the clock
    let lastBeat = 0
    let lastPhase = 0
    if (!this.linkEnable) {
      log.error('Link server not enabled, no reason to start DownbeatClock')
      return
    }
    this.startUpdate(
      LinkServerElectron.downbeatUpdateRate_ms,
      (beat, phase) => {
        beat = 0 ^ beat
        if (0 < beat - lastBeat) {
          this.window.webContents.send(this.prefixMessage('beat'), { beat })
          lastBeat = beat
        }
        if (0 > phase - lastPhase) {
          this.window.webContents.send(this.prefixMessage('downbeat'))
        }
        lastPhase = phase
      }
    )
  }

  stopDownbeatClock(): void {
    // log.warn('downbeatClock disabled')
    // Stop the LINK-based downbeat clock
    this.stopUpdate()
  }

  enable(): void {
    super.enable()
    this.startDownbeatClock()
  }

  disable(): void {
    super.disable()
    this.stopDownbeatClock()
  }
}
