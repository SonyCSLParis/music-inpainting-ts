type linkUpdateCallback = (
  beat: number,
  phase: number,
  bpm: number,
  playState: boolean
) => any
import { ipcRenderer, IpcRendererEvent } from 'electron'
import { exposeInMainWorld } from './exposeInMainWorld'

type Callback = (...args: any[]) => void
type IpcRendererCallback = (event: IpcRendererEvent, ...args: any[]) => void
const enum AbletonLinkApiMessage {
  'bpm' = 'bpm',
  'phase' = 'phase',
  'state' = 'state',
}

export interface IAbletonApi {
  disable(): void
  onStateUpdate(callback: linkUpdateCallback): string | undefined
  removeStateUpdateCallback(key: string): boolean | undefined
  startUpdateLoop(frequency: number): void
  stopUpdateLoop(): void
}

export class AbletonLinkApi implements IAbletonApi {
  protected listeners: Map<
    AbletonLinkApiMessage,
    Map<string, IpcRendererCallback>
  > = new Map()
  static ipcMessagePrefix = 'abletonlink/'

  protected makeIPCRendererCallbackFromEventFreeCallback(
    callback: Callback
  ): IpcRendererCallback {
    return (event: IpcRendererEvent, ...args: any[]) => callback(...args)
  }

  protected registerCallback(
    message: AbletonLinkApiMessage,
    callback: Callback
  ): string | undefined {
    const saferFn: IpcRendererCallback = (
      event: IpcRendererEvent,
      ...args: any[]
    ) => callback(...args)
    // Deliberately strip event as it includes `sender`
    ipcRenderer.on(AbletonLinkApi.ipcMessagePrefix + message, saferFn)
    const key = Symbol().toString()
    if (!this.listeners.has(message)) {
      this.listeners.set(message, new Map())
    }
    if (this.listeners.get(message)?.set?.(key, saferFn) != undefined) {
      return key
    } else {
      return undefined
    }
  }

  protected send(channel: string, ...args: any[]): void {
    ipcRenderer.send(AbletonLinkApi.ipcMessagePrefix + channel, ...args)
  }

  onStateUpdate(callback: linkUpdateCallback): string | undefined {
    return this.registerCallback(AbletonLinkApiMessage.state, callback)
  }
  removeStateUpdateCallback(key: string): boolean | undefined {
    return this.listeners.get(AbletonLinkApiMessage.state)?.delete?.(key)
  }

  startUpdateLoop(frequency: number) {
    this.send('startUpdateLoop', frequency)
  }
  stopUpdateLoop() {
    this.send('stopUpdateLoop')
  }

  disable(): void {
    this.send('disable')
  }
}

export const abletonLinkApi = new AbletonLinkApi()

exposeInMainWorld('abletonLinkApi', {
  disable: () => abletonLinkApi.disable(),

  onStateUpdate: (callback: linkUpdateCallback) =>
    abletonLinkApi.onStateUpdate(callback),
  removeStateUpdateCallback: (key: string) =>
    abletonLinkApi.removeStateUpdateCallback(key),

  startUpdateLoop: (frequency: number) =>
    abletonLinkApi.startUpdateLoop(frequency),
  stopUpdateLoop: () => abletonLinkApi.stopUpdateLoop(),
})
