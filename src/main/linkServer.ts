import LinkElectronModule = require('./linkServer.electron')
import LinkSocketModule = require('./linkServer.socket-io')  // TODO(theis): use external package ableton-link-server

// wrapper for the different available implementations of the Link Client
// implemented as described in
// https://github.com/TypeStrong/ts-loader/tree/master/test/comparison-tests/conditionalRequire

let Server;
declare var COMPILE_ELECTRON: boolean;  // uses webpack.DefinePlugin
if ( COMPILE_ELECTRON ) {
    let LinkElectron = <typeof LinkElectronModule>require('./linkServer.electron');
    Server = LinkElectron
}
else {
    throw Error("Not implemented")
    let LinkSocket = <typeof LinkSocketModule>require('./linkServer.socket-io');
    Server = LinkSocket
}

export default Server
