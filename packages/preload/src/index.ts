/**
 * @module preload
 */

import { exposeInMainWorld } from './exposeInMainWorld'
import './ipcRendererInterface'
import './abletonLinkApi'

// FIXME(@tbazin, 2022/05/09): might be a security issue
exposeInMainWorld('global', globalThis)
