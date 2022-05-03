/**
 * @module preload
 */

import { exposeInMainWorld } from './exposeInMainWorld'
import { ipcRenderer, shell } from 'electron'

exposeInMainWorld('ipcRenderer', ipcRenderer)
exposeInMainWorld('electronShell', shell)
exposeInMainWorld('global', globalThis)
