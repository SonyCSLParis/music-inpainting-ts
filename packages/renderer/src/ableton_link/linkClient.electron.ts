import type { IpcRendererEvent } from 'electron'
import { AbletonLinkClient } from './linkClient.abstract'

import default_config from '../../../common/default_config.json'
import { BPMControl } from '../numberControl'

const VITE_COMPILE_ELECTRON = import.meta.env.VITE_COMPILE_ELECTRON != undefined

const link_channel_prefix: string = default_config['link_channel_prefix']

type IpcRendererCallback = (event: IpcRendererEvent, ...args: any[]) => any

export class AbletonLinkClientElectron extends AbletonLinkClient {
  readonly abletonLinkAPI = window.abletonLinkApi
}
