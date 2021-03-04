import LinkElectronModule = require('./linkClient.electron')
import LinkSocketModule = require('./linkClient.socket-io')

// wrapper for the different available implementations of the Link Client
// implemented as described in
// https://github.com/TypeStrong/ts-loader/tree/master/test/comparison-tests/conditionalRequire

let Client

// defined at compile-time via webpack.DefinePlugin
declare let COMPILE_ELECTRON: boolean

if (COMPILE_ELECTRON) {
  const LinkElectron = <typeof LinkElectronModule>(
    require('./linkClient.electron')
  )
  Client = LinkElectron
} else {
  const LinkSocket = <typeof LinkSocketModule>require('./linkClient.socket-io')
  Client = LinkSocket
}

export default Client
