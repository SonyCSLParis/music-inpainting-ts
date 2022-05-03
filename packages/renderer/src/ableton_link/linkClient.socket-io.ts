import { io, Socket } from 'socket.io-client'
import { AbletonLinkClient } from './linkClient.abstract'

import default_config from '../../../common/default_config.json'
import { BPMControl } from '../numberControl'

const link_channel_prefix: string = default_config['link_channel_prefix']

type SocketIOCallback = (...args: any[]) => void
export class LinkClientSocketIO extends AbletonLinkClient {
  protected readonly socket: Socket
  static defaultServerURL = new URL('http://localhost:3000')

  constructor(
    bpmControl: BPMControl,
    serverUrl = LinkClientSocketIO.defaultServerURL
  ) {
    super(bpmControl)
    this.socket = io(serverUrl)
    this.socket.on('connect', () => this.getState())
  }

  // Schedule a LINK dependent callback
  onServerMessage(message: string, callback: SocketIOCallback): this {
    this.socket.on(link_channel_prefix + message, callback.bind(this))
    return this
  }
  // Schedule a LINK dependent callback once
  onServerMessageOnce(message: string, callback: SocketIOCallback): this {
    this.socket.once(link_channel_prefix + message, callback.bind(this))
    return this
  }
  // Send values to the Ableton Link server
  sendToServer(message: string, ...args: any[]): this {
    this.socket.emit(link_channel_prefix + message, ...args)
    return this
  }
  // Schedule a LINK dependent callback once
  removeServerListener(message: string, callback: SocketIOCallback): this {
    this.socket.off(link_channel_prefix + message, callback)
    return this
  }
  removeAllServerListeners(message: string): this {
    this.socket.removeAllListeners(message)
    return this
  }
}
