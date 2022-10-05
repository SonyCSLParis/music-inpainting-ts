import { ipcRenderer, IpcRendererEvent } from 'electron'

type Callback = (...args: any[]) => void
type IpcRendererCallback = (event: IpcRendererEvent, ...args: any[]) => void

export abstract class SafeElectronApi<Messages extends string> {
  protected listeners: Map<
    Messages | 'pong' | 'is-enabled',
    Map<string, IpcRendererCallback>
  > = new Map()

  protected makeIPCRendererCallbackFromEventFreeCallback(
    callback: Callback
  ): IpcRendererCallback {
    // strip event for security reasons as it includes `sender`
    return (event: IpcRendererEvent, ...args: any[]) => callback(...args)
  }

  protected registerCallback(
    message: Messages | 'pong' | 'is-enabled',
    callback: Callback,
    windowId?: number
  ): string | undefined {
    const saferFn: IpcRendererCallback = (
      event: IpcRendererEvent,
      ...args: any[]
    ) => {
      callback(...args)
    }
    ipcRenderer.on(this.prefixChannel(message, windowId), saferFn)
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

  abstract readonly channelPrefix: string

  protected send(channel: string, windowId?: number, ...args: any[]): void {
    const prefixedChannel = this.prefixChannel(channel, windowId)
    ipcRenderer.send(prefixedChannel, ...args)
  }
  protected invoke(
    channel: string,
    windowId?: number,
    ...args: any[]
  ): Promise<any> {
    const prefixedChannel = this.prefixChannel(channel, windowId)
    return ipcRenderer.invoke(prefixedChannel, ...args)
  }

  protected prefixChannel(message: string, windowId?: number): string {
    return (
      this.channelPrefix +
      message +
      (windowId != null ? `/window-${windowId}/` : '')
    )
  }
}
