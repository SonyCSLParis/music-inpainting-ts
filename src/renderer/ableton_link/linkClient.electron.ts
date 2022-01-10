import { ipcRenderer, IpcRendererEvent } from 'electron'
import { AbletonLinkClient } from './linkClient.abstract'

import default_config from '../../common/default_config.json'
import { BPMControl } from '../numberControl'

const link_channel_prefix: string = default_config['link_channel_prefix']

type IpcRendererCallback = (event: IpcRendererEvent, ...args: any[]) => any
export class LinkClientElectron extends AbletonLinkClient {
  protected _windowID?: number
  protected get windowID(): number {
    if (this._windowID == null) {
      this._windowID = <number>ipcRenderer.sendSync('get-window-id')
    }
    return this._windowID
  }

  constructor(bpmControl: BPMControl) {
    super(bpmControl)
  }

  protected prefixMessage(message: string): string {
    return link_channel_prefix + this.windowID.toString() + message
  }

  // Schedule a LINK dependent callback
  onServerMessage(message: string, callback: IpcRendererCallback): this {
    ipcRenderer.on(this.prefixMessage(message), callback.bind(this))
    return this
  }
  // Schedule a LINK dependent callback once
  onServerMessageOnce(message: string, callback: IpcRendererCallback): this {
    ipcRenderer.once(this.prefixMessage(message), callback.bind(this))
    return this
  }
  // Send values to the Ableton Link server
  sendToServer(message: string, ...args: any[]): void {
    ipcRenderer.send(this.prefixMessage(message), ...args)
  }
  removeServerListener(message: string, callback: IpcRendererCallback): void {
    ipcRenderer.removeListener(this.prefixMessage(message), callback)
  }
  removeAllServerListeners(message: string): void {
    ipcRenderer.removeAllListeners(this.prefixMessage(message))
  }

  getPhaseAsync(): Promise<number> {
    return <Promise<number>>ipcRenderer.invoke(this.prefixMessage('get-phase'))
  }
}
