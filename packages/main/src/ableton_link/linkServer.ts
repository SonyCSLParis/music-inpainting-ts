import AbletonLink from 'abletonlink'
import log from 'loglevel'

declare module 'abletonlink' {
  interface AbletonLinkBase {
    linkEnable: boolean
    get playState(): boolean
    get phase(): number
    get quantum(): number
    set quantum(quantum: number)
    get bpm(): number
    set bpm(newBpm: number)
    get numPeers(): number
  }
}

// wrapper for the different available implementations of the Link Client
// implemented as described in
// https://github.com/TypeStrong/ts-loader/tree/master/test/comparison-tests/conditionalRequire

export abstract class LinkServer<CommunicationTargetT> extends AbletonLink {
  readonly linkChannelPrefix: string = 'abletonlink/'
  protected communicationTargets: Map<number, CommunicationTargetT> = new Map()
  protected readonly downbeatUpdateRate_ms: number = 10
  constructor(
    bpm?: number,
    quantum?: number,
    enable?: boolean,
    downbeatUpdateRate_ms?: number
  ) {
    super(bpm, quantum, enable)
    if (downbeatUpdateRate_ms != null) {
      this.downbeatUpdateRate_ms = downbeatUpdateRate_ms
    }
    this.init()
    this.attachListeners()
  }

  // protected get linkEnable(): boolean {
  //   return this.linkEnable
  // }

  protected prefixMessage(message: string): string {
    return this.linkChannelPrefix + message
  }

  protected abstract sendToClient(
    communicationTarget: CommunicationTargetT,
    message: string,
    ...args: any[]
  ): void

  protected broadcastToClients(message: string, ...args: any[]): void {
    this.communicationTargets.forEach((client) =>
      this.sendToClient(client, message, ...args)
    )
  }

  protected abstract targetToId(
    communicationTarget: CommunicationTargetT
  ): number

  registerTarget(communicationTarget: CommunicationTargetT) {
    log.debug('Registered Link target')
    this.communicationTargets.set(
      this.targetToId(communicationTarget),
      communicationTarget
    )
  }

  protected init(): void {
    // TODO(theis): how to detect errors in initialization?
    this.on('tempo', (tempo: number) => {
      log.info('LINK: tempo changed, now ' + tempo.toFixed(2))
      this.broadcastToClients(this.prefixMessage('tempo'), tempo)
    })
    this.on('numPeers', (numPeers: number) => {
      log.info('LINK: numPeers changed, now ' + numPeers.toString())
      this.broadcastToClients(this.prefixMessage('numPeers'), numPeers)
    })

    this.broadcastToClients(this.prefixMessage('initialized-status'), true)
  }

  abstract attachListeners(): void

  protected startDownbeatClock(): void {
    // Start a LINK-based downbeat clock using IPC messages
    let lastBeat = 0
    let lastPhase = 0
    if (!this.linkEnable) {
      log.error('Link server not enabled, no reason to start DownbeatClock')
      return
    }
    this.startUpdate(this.downbeatUpdateRate_ms, (beat, phase) => {
      beat = 0 ^ beat
      if (0 > phase - lastPhase) {
        this.broadcastToClients(this.prefixMessage('downbeat'))
      }
      if (0 < beat - lastBeat) {
        this.broadcastToClients(this.prefixMessage('beat'), beat)
        lastBeat = beat
      }
      lastPhase = phase
    })
  }

  stopDownbeatClock(): void {
    log.warn('disabling downbeatClock')
    // Stop the LINK-based downbeat clock
    this.stopUpdate()
  }

  async enable(): Promise<void> {
    if (this.linkEnable) {
      return
    } else {
      super.enable()
      this.startDownbeatClock()
    }
  }

  protected abstract isEnabled(
    communicationTarget: CommunicationTargetT
  ): Promise<boolean>

  async disable(): Promise<void> {
    const targetsEnabled = await Promise.all(
      Array.from(this.communicationTargets.values()).map((target) =>
        this.isEnabled(target)
      )
    )
    if (targetsEnabled.some((value) => value)) {
      return
    } else {
      this.stopDownbeatClock()
      super.disable()
    }
  }
}

// HACK(theis): clean this by creating a proper TypeScript interface and two implementations
let Server: typeof LinkServer | undefined = undefined

const COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

if (COMPILE_ELECTRON) {
  import('./linkServer.electron')
    .then((linkServerElectronModule) => {
      Server = linkServerElectronModule.LinkServerElectron
    })
    .catch((e) => {
      throw e
    })
} else {
  throw new Error('Not implemented')
}

export default Server
