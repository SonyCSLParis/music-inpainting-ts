import * as LinkClientElectron from './linkClient.electron'
import * as LinkClientSocket from './linkClient.socket-io'

// wrapper for the different available implementations of the Link Client
// implemented as described in
// https://github.com/TypeStrong/ts-loader/tree/master/test/comparison-tests/conditionalRequire

let Client

// defined at compile-time via webpack.DefinePlugin
declare const COMPILE_ELECTRON: boolean

if (COMPILE_ELECTRON) {
  const LinkElectron = <typeof LinkClientElectron>(
    require('./linkClient.electron')
  )
  Client = LinkElectron
} else {
  const LinkSocket = <typeof LinkClientSocket>require('./linkClient.socket-io')
  Client = LinkSocket
}

export default Client
