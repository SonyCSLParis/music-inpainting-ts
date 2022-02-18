import { ipcRenderer, IpcRendererEvent } from 'electron'
import { AbletonLinkClient } from './linkClient.abstract'

import default_config from '../../common/default_config.json'
import { BPMControl } from '../numberControl'

const link_channel_prefix: string = default_config['link_channel_prefix']

type IpcRendererCallback = (event: IpcRendererEvent, ...args: any[]) => any
export class LinkClientElectron extends AbletonLinkClient {
  protected _windowID?: number
  protected async windowID(): Promise<number> {
    if (this._windowID == null) {
      this._windowID = <number>await ipcRenderer.invoke('get-window-id')
    }
    return this._windowID
  }

  constructor(bpmControl: BPMControl) {
    super(bpmControl)
  }

  protected async prefixMessage(message: string): Promise<string> {
    return link_channel_prefix + (await this.windowID()).toString() + message
  }

  // Schedule a LINK dependent callback
  async onServerMessage(
    message: string,
    callback: IpcRendererCallback
  ): Promise<this> {
    ipcRenderer.on(await this.prefixMessage(message), callback.bind(this))
    return this
  }
  // Schedule a LINK dependent callback once
  async onServerMessageOnce(
    message: string,
    callback: IpcRendererCallback
  ): Promise<this> {
    ipcRenderer.once(await this.prefixMessage(message), callback.bind(this))
    return this
  }
  // Send values to the Ableton Link server
  async sendToServer(message: string, ...args: any[]): Promise<void> {
    ipcRenderer.send(await this.prefixMessage(message), ...args)
  }
  async removeServerListener(
    message: string,
    callback: IpcRendererCallback
  ): Promise<void> {
    ipcRenderer.removeListener(await this.prefixMessage(message), callback)
  }
  async removeAllServerListeners(message: string): Promise<void> {
    ipcRenderer.removeAllListeners(await this.prefixMessage(message))
  }

  async getPhaseAsync(): Promise<number> {
    return <Promise<number>>(
      ipcRenderer.invoke(await this.prefixMessage('get-phase'))
    )
  }
}
