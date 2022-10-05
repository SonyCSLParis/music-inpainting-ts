/**
 * @module preload
 */

import { exposeInMainWorld } from './exposeInMainWorld'
import './ipcRendererInterface'
import './abletonLinkApi'

// necessary to use @magenta/music
import dup from 'dup'
const typedArray_pool = {
  UINT8: dup([32, 0]),
  UINT16: dup([32, 0]),
  UINT32: dup([32, 0]),
  BIGUINT64: dup([32, 0]),
  INT8: dup([32, 0]),
  INT16: dup([32, 0]),
  INT32: dup([32, 0]),
  BIGINT64: dup([32, 0]),
  FLOAT: dup([32, 0]),
  DOUBLE: dup([32, 0]),
  DATA: dup([32, 0]),
  UINT8C: dup([32, 0]),
  BUFFER: dup([32, 0]),
}
globalThis.__TYPEDARRAY_POOL = typedArray_pool

// FIXME(@tbazin, 2022/05/09): might be a security issue
exposeInMainWorld('global', globalThis)
