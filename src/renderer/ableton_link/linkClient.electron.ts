import { ipcRenderer, IpcRendererEvent } from 'electron'
import { AbletonLinkClient } from './linkClient.abstract'

import default_config from '../../common/default_config.json'
import { BPMControl } from '../numberControl'
import log from 'loglevel'

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
    log.info(this.prefixMessage(message))
    ipcRenderer.on(this.prefixMessage(message), callback.bind(this))
    return this
  }
  // Schedule a LINK dependent callback once
  onServerMessageOnce(message: string, callback: IpcRendererCallback): this {
    log.info(this.prefixMessage(message))
    ipcRenderer.once(this.prefixMessage(message), callback.bind(this))
    return this
  }
  // Send values to the Ableton Link server
  sendToServer(message: string, ...args: any[]): this {
    ipcRenderer.send(this.prefixMessage(message), ...args)
    return this
  }
  removeServerListener(message: string, callback: IpcRendererCallback): this {
    ipcRenderer.removeListener(this.prefixMessage(message), callback)
    return this
  }
  removeAllServerListeners(message: string): this {
    ipcRenderer.removeAllListeners(this.prefixMessage(message))
    return this
  }
}
