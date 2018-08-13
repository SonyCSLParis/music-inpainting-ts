import LinkElectronModule = require('./linkClient.electron')
import LinkSocketModule = require('./linkClient.socket-io')

// wrapper for the different available implementations of the Link Client
// implemented as described in
// https://github.com/TypeStrong/ts-loader/tree/master/test/comparison-tests/conditionalRequire

let Client;
declare var COMPILE_ELECTRON: boolean;  // uses webpack.DefinePlugin
if ( COMPILE_ELECTRON ) {
    let LinkElectron = <typeof LinkElectronModule>require('./linkClient.electron');
    Client = LinkElectron
}
else {
    let LinkSocket = <typeof LinkSocketModule>require('./linkClient.socket-io');
    Client = LinkSocket
}

export default Client
