import { SafeElectronApi } from './safeElectronApi'
import { exposeInMainWorld } from './exposeInMainWorld'

type linkUpdateCallback = (
  beat: number,
  phase: number,
  bpm: number,
  playState: boolean
) => any

export type AbletonLinkServerEvent = {
  tempo: (tempo: number) => void
  numPeers: (numPeers: number) => void
  quantum: (quantum: number) => void
  phase: (phase: number) => void
  playState: (playing: boolean) => void
  downbeat: () => void
}

const enum AbletonLinkApiMessage {
  'tempo' = 'tempo',
  'phase' = 'phase',
  'state' = 'state',
  'downbeat' = 'downbeat',
  'numPeers' = 'numPeers',
  'quantum' = 'quantum',
  'playState' = 'playState',
}

export interface IAbletonLinkApi {
  onNumPeers(
    windowId: number,
    callback: (numPeers: number) => void
  ): string | undefined
  onPhase(
    windowId: number,
    callback: (phase: number) => void
  ): string | undefined
  onTempo(
    windowId: number,
    callback: (tempo: number) => void
  ): string | undefined
  onQuantum(
    windowId: number,
    callback: (tempo: number) => void
  ): string | undefined
  onDownbeat(windowId: number, callback: () => void): string | undefined
  onPong(windowId: number, callback: () => void): string | undefined
  onIsEnabled(windowId: number, callback: () => void): string | undefined

  setTempo(windowId: number, newTempo: number): void
  setQuantum(windowId: number, newQuantum: number): void

  requestQuantumAsync(windowId: number): void
  requestPhaseAsync(windowId: number): void
  requestTempoAsync(windowId: number): void

  ping(windowId: number): Promise<void>
  enable(windowId: number): Promise<void>
  notifyEnabled(windowId: number): Promise<void>
  disable(windowId: number): Promise<void>
}

export class AbletonLinkApi
  extends SafeElectronApi<AbletonLinkApiMessage>
  implements IAbletonLinkApi
{
  readonly channelPrefix: string = 'ableton/'

  onStateUpdate = (
    windowId: number,
    callback: linkUpdateCallback
  ): string | undefined => {
    return this.registerCallback(
      AbletonLinkApiMessage.state,
      callback,
      undefined
    )
  }
  removeStateUpdateCallback = (key: string): boolean | undefined => {
    return this.listeners.get(AbletonLinkApiMessage.state)?.delete?.(key)
  }

  onPhase = (
    windowId: number,
    callback: (phase: number) => void
  ): string | undefined => {
    return this.registerCallback(AbletonLinkApiMessage.phase, callback)
  }
  onNumPeers = (
    windowId: number,
    callback: (numPeers: number) => void
  ): string | undefined => {
    return this.registerCallback(AbletonLinkApiMessage.numPeers, callback)
  }
  onTempo = (
    windowId: number,
    callback: (tempo: number) => void
  ): string | undefined => {
    return this.registerCallback(AbletonLinkApiMessage.tempo, callback)
  }
  onQuantum = (
    windowId: number,
    callback: (quantum: number) => void
  ): string | undefined => {
    return this.registerCallback(AbletonLinkApiMessage.quantum, callback)
  }
  onDownbeat = (windowId: number, callback: () => void): string | undefined => {
    return this.registerCallback(AbletonLinkApiMessage.downbeat, callback)
  }
  onPlayState = (
    windowId: number,
    callback: (playing: boolean) => void
  ): string | undefined => {
    return this.registerCallback(AbletonLinkApiMessage.playState, callback)
  }
  onPong = (windowId: number, callback: () => void): string | undefined => {
    return this.registerCallback('pong', callback)
  }
  onIsEnabled = (
    windowId: number,
    callback: () => void
  ): string | undefined => {
    return this.registerCallback('is-enabled', callback)
  }

  requestPhaseAsync = (windowId: number): void => {
    return this.send('get-phase')
  }
  requestTempoAsync = (windowId: number): void => {
    return this.send('get-tempo')
  }
  requestQuantumAsync = (windowId: number): void => {
    return this.send('get-quantum')
  }
  requestPlayStateAsync = (windowId: number): void => {
    return this.send('get-play-state')
  }

  setQuantum = (windowId: number, newQuantum: number): void => {
    return this.send('set-quantum', undefined, newQuantum)
  }
  setTempo = (windowId: number, newTempo: number): void => {
    return this.send('set-tempo', undefined, newTempo)
  }

  enable = async (windowId: number): Promise<void> => {
    await this.send('enable')
  }
  disable = async (windowId: number): Promise<void> => {
    await this.send('disable')
  }

  notifyEnabled = async (windowId: number): Promise<void> => {
    this.send('enabled', windowId)
  }
  ping = async (windowId: number): Promise<void> => {
    await this.send('ping')
  }
}

export const abletonLinkApi = new AbletonLinkApi()

exposeInMainWorld('abletonLinkApi', abletonLinkApi)
