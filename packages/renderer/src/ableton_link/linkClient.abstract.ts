import { EventEmitter } from 'events'
import { TypedEmitter } from 'tiny-typed-emitter'
import log from 'loglevel'
import { BPMControl } from '../numberControl'
import {
  AbletonLinkServerEvent,
  IAbletonLinkApi,
} from '../../../preload/src/abletonLinkApi'

export interface LinkClientConstructor {
  new (bpmControl: BPMControl, quantum?: number): AbletonLinkClient
}

export type AbletonLinkClientRequest = {
  'get-phase': (never: never) => void
  'get-quantum': (never: never) => void
  'get-tempo': (never: never) => void
  'get-numPeers': (never: never) => void

  'set-tempo': (tempo: number) => void
  'set-quantum': (quantum: number) => void
}

type AbletonLinkEvent = AbletonLinkServerEvent & AbletonLinkClientRequest

export abstract class AbletonLinkServerEmitter extends TypedEmitter<AbletonLinkEvent> {}

export abstract class AbletonLinkClient extends EventEmitter {
  protected readonly windowId = window.electronWindowId
  readonly abletonLinkAPI: Readonly<IAbletonLinkApi> = window.abletonLinkApi

  // // TODO(@tbazin, 2021/09/13): fix event type, use a type variable?
  // protected onServerMessage<T extends keyof AbletonLinkServerEvent>(
  //   message: T,
  //   callback: AbletonLinkEvent[T]
  // ): this {
  //   this.abletonLinkAPI.on(message, callback)
  //   return this
  // }
  // protected onServerMessageOnce<T extends keyof AbletonLinkServerEvent>(
  //   message: T,
  //   callback: AbletonLinkEvent[T]
  // ): this {
  //   this.abletonLinkAPI.once(message, callback)
  //   return this
  // }

  // protected abletonLinkAPI.<T extends keyof AbletonLinkClientRequest>(
  //   message: T,
  //   data: Parameters<AbletonLinkEvent[T]>
  // ): this {
  //   this.abletonLinkAPI.emit(message, ...data)
  //   return this
  // }

  // protected removeServerListener<T extends keyof AbletonLinkServerEvent>(
  //   message: T,
  //   callback: AbletonLinkEvent[T]
  // ): void {
  //   this.abletonLinkAPI.removeListener(message, callback)
  // }
  // protected abstract removeAllServerListeners(
  //   message: AbletonLinkServerEvent
  // ): void
  // protected enabled = false
  // protected _initialized = false
  // get initialized(): boolean {
  //   return this._initialized
  // }

  readonly bpmControl: BPMControl
  constructor(bpmControl: BPMControl) {
    super()
    // document.body.addEventListener('beforeunload', () => this.disableServer())

    this.bpmControl = bpmControl
    // disable server on client initialization: this is required to avoid
    // leaving a leftover active server if the page is reloaded
    // this.disableServer()

    // register Ableton Link related callbacks
    this.registerOnBpmChangeCallback()
    this.registerOnQuantumChangeCallback()
    this.registerOnNumPeersChangeCallback()

    this.registerOnInterfaceBpmChangeCallback()

    this.abletonLinkAPI.onIsEnabled(this.windowId, () => {
      if (this.isEnabled) {
        this.abletonLinkAPI.notifyEnabled(this.windowId)
      }
    })
    this.abletonLinkAPI.onDownbeat(this.windowId, () => {
      if (this.isEnabled) {
        this.emit('downbeat')
      }
    })
    // this.onServerMessage('check-enabled', () => {
    //   if (this.isEnabled) {
    //     this.abletonLinkAPI.('checks-enabled')
    //   }
    // })

    // this._initialized = true
    this.emit('client-initialized')
  }

  protected registerOnNumPeersChangeCallback(): void {
    this.abletonLinkAPI.onNumPeers(this.windowId, (numPeers: number) => {
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

  requestPhaseAsync(): void {
    this.abletonLinkAPI.requestPhaseAsync(this.windowId)
  }

  async enableServer(): Promise<void> {
    await this.abletonLinkAPI.enable(this.windowId)
    // return new Promise<void>((resolve) => {
    //   this.onServerMessageOnce('link-enabled-success', () => {
    //     resolve()
    //   })
    // })
  }

  protected registerOnBpmChangeCallback(): void {
    this.abletonLinkAPI.onTempo(this.windowId, (newBPM: number) => {
      this.bpmControl.emit('link-tempo-changed', newBPM)
      log.debug(
        `Received BPM update from Ableton Link Server with value ${newBPM}`
      )
    })
  }

  protected registerOnQuantumChangeCallback(): void {
    this.abletonLinkAPI.onQuantum(this.windowId, (quantum: number) => {
      this.emit('quantum', quantum)
      log.debug(
        `Received quantum update from Ableton Link Server with value ${quantum}`
      )
    })
  }

  protected _enabled: boolean = false
  get isEnabled(): boolean {
    return this._enabled
  }

  async enable(): Promise<void> {
    await this.enableServer()
    this._enabled = true
    this.emitSynchronizationMessage()
  }
  async disable(): Promise<void> {
    await this.disableServer()
    this._enabled = false
  }

  async disableServer(): Promise<void> {
    await this.abletonLinkAPI.disable(this.windowId)
  }

  // killServer(): void {
  //   this.abletonLinkAPI.('kill')
  // }

  // retrieve current BPM from Link
  setBPMtoLinkBPM_async(): void {
    if (this.isEnabled) {
      // server is expected to reply with a 'bpm' message
      this.abletonLinkAPI.requestTempoAsync(this.windowId)
    }
  }

  setLinkServerBPM(bpm: number): void {
    if (this.isEnabled) {
      this.abletonLinkAPI.setTempo(this.windowId, bpm)
    }
  }

  // the `quantum` defines the desired number of quarter-notes between each
  // 'downbeat', which are used to synchronize Play events.
  // with a `quantum` of 4, NONOTO will wait and start playback on the
  // beginning of a new measure (in a 4/4 time-signature setting)
  protected requestQuantum(): void {
    this.abletonLinkAPI.requestQuantumAsync(this.windowId)
  }
  protected setQuantum(newQuantum: number): Promise<number> {
    return this.abletonLinkAPI.setQuantum(this.windowId, newQuantum)
  }

  protected getState(): void {
    // get current state of the LINK-server on loading the client
    this.abletonLinkAPI.ping(this.windowId)
  }
  async pingServer(): Promise<void> {
    // // clean-up potential existing listeners
    // this.removeAllServerListeners('pong')

    const pingResponse = new Promise<void>((resolve) => {
      this.abletonLinkAPI.onPong(this.windowId, resolve)
    })
    await this.abletonLinkAPI.ping(this.windowId)
    return pingResponse
  }
}
