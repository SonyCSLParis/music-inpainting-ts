import EventEmitter from 'events'
import log from 'loglevel'
import { BPMControl } from '../numberControl'

export interface LinkClientConstructor {
  new (bpmControl: BPMControl, quantum?: number): AbletonLinkClient
}

export abstract class AbletonLinkClient extends EventEmitter {
  // TODO(@tbazin, 2021/09/13): fix event type, use a type variable?
  abstract onServerMessage(
    message: string,
    callback: (event: any, ...args: any[]) => any
  ): void
  abstract onServerMessageOnce(
    message: string,
    callback: (event: any, ...args: any[]) => any
  ): void
  abstract sendToServer(message: string, ...args: any[]): void
  abstract sendToServerSync(message: string, ...args: any[]): any
  abstract removeServerListener(
    message: string,
    callback: (event: any, ...args: any[]) => any
  ): void
  abstract removeAllServerListeners(message: string): void

  getPhaseSync(): number {
    return <number>this.sendToServerSync('get-phase-sync')
  }

  protected enabled = false
  protected _initialized = false
  get initialized(): boolean {
    return this._initialized
  }

  readonly bpmControl: BPMControl
  constructor(bpmControl: BPMControl) {
    super()
    document.body.addEventListener('beforeunload', () => this.disableServer())

    this.bpmControl = bpmControl
    // disable server on client initialization: this is required to avoid
    // leaving a leftover active server if the page is reloaded
    this.disableServer()

    // register Ableton Link related callbacks
    this.registerOnBpmChangeCallback()
    this.registerOnQuantumChangeCallback()
    this.registerOnNumPeersChangeCallback()

    this.registerOnInterfaceBpmChangeCallback()

    this.onServerMessage('downbeat', () => {
      if (this.isEnabled) {
        this.emit('downbeat')
      }
    })
    this.onServerMessage('check-enabled', () => {
      if (this.isEnabled) {
        this.sendToServer('checks-enabled')
      }
    })

    this._initialized = true
    this.emit('client-initialized')
  }

  protected registerOnNumPeersChangeCallback(): void {
    this.onServerMessage('numPeers', (_, numPeers: number) => {
      if (this.isEnabled) {
        // this display is required as per the Ableton-link test-plan
        // (https://github.com/Ableton/link/blob/master/TEST-PLAN.md)
        this.triggerNotification(
          'NONOTO | Ableton Link',
          'Number of peers changed, now ' +
            numPeers.toString() +
            ' peer' +
            (numPeers == 1 ? '' : 's'),
          4000
        )
      }
    })
  }

  protected registerOnInterfaceBpmChangeCallback(): void {
    this.bpmControl.on('interface-tempo-changed', (newBpm: number) => {
      this.setLinkServerBPM(newBpm)
    })
  }

  protected triggerNotification(
    title: string,
    body: string,
    timeout = 0
  ): void {
    const notification = new Notification(title, {
      body: body,
    })
    if (timeout > 0) {
      setTimeout(() => notification.close(), timeout)
    }
  }

  emitSynchronizationMessage(): void {
    this.emit('enabled')
    this.setBPMtoLinkBPM_async()
  }

  enableServer(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.onServerMessageOnce('link-enabled-success', () => {
        resolve()
      })
      this.sendToServer('enable')
    })
  }

  protected registerOnBpmChangeCallback(): void {
    this.onServerMessage('bpm', (_, newBPM: number) => {
      this.bpmControl.emit('link-tempo-changed', newBPM)
      log.debug(
        `Received BPM update from Ableton Link Server with value ${newBPM}`
      )
    })
  }

  protected registerOnQuantumChangeCallback(): void {
    this.onServerMessage('quantum', (_, quantum: number) => {
      this.emit('quantum', quantum)
      log.debug(
        `Received quantum update from Ableton Link Server with value ${quantum}`
      )
    })
  }

  async enable(): Promise<void> {
    await this.enableServer()
    this.enabled = true
    this.emitSynchronizationMessage()
  }
  disable(): void {
    this.disableServer()
    this.enabled = false
  }

  disableServer(): void {
    this.sendToServer('disable')
  }

  killServer(): void {
    this.sendToServer('kill')
  }

  // retrieve current BPM from Link
  setBPMtoLinkBPM_async(): void {
    if (this.isEnabled) {
      // server is expected to reply with a 'bpm' message
      this.sendToServer('get-bpm')
    }
  }

  setLinkServerBPM(bpm: number): void {
    if (this.isEnabled) {
      this.sendToServer('set-bpm', bpm)
    }
  }

  // the `quantum` defines the desired number of quarter-notes between each
  // 'downbeat', which are used to synchronize Play events.
  // with a `quantum` of 4, NONOTO will wait and start playback on the
  // beginning of a new measure (in a 4/4 time-signature setting)
  protected requestQuantum(): void {
    this.sendToServer('get-quantum')
  }
  protected setQuantum(newQuantum: number): void {
    return this.sendToServer('set-quantum', newQuantum)
  }

  protected getState(): void {
    // get current state of the LINK-server on loading the client
    this.sendToServer('ping')
  }
  pingServer(): Promise<void> {
    // clean-up potential existing listeners
    this.removeAllServerListeners('pong')

    const pingResponse = new Promise<void>((resolve) => {
      this.onServerMessageOnce('pong', resolve)
    })
    this.sendToServer('ping')
    return pingResponse
  }
  get isEnabled(): boolean {
    return this.enabled
  }
}
