import AbletonLink from 'abletonlink'
// TODO(theis): use external package ableton-link-server
// import LinkSocketModule = require('./linkServer.socket-io')

// wrapper for the different available implementations of the Link Client
// implemented as described in
// https://github.com/TypeStrong/ts-loader/tree/master/test/comparison-tests/conditionalRequire

export abstract class LinkServer extends AbletonLink {
  static downbeatUpdateRate_ms = 10
  constructor(
    communicationTarget: any,
    bpm?: number,
    quantum?: number,
    enable?: boolean
  ) {
    super(bpm, quantum, enable)
  }

  protected abstract prefixMessage(message: string): string

  abstract init(): void

  abstract attachListeners(): void

  abstract startDownbeatClock(): void

  stopDownbeatClock(): void {
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

// HACK(theis): clean this by creating a proper TypeScript interface and two implementations
let Server: typeof LinkServer | undefined = undefined

const COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

if (COMPILE_ELECTRON) {
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
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
