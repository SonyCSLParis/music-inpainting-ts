import { LinkClientConstructor } from './linkClient.abstract'

let AbletonLinkClientImplementation: LinkClientConstructor

// defined at compile-time via webpack.DefinePlugin
const VITE_COMPILE_ELECTRON: boolean =
  import.meta.env.VITE_COMPILE_ELECTRON != undefined

export async function getAbletonLinkClientClass(): Promise<LinkClientConstructor> {
  if (!AbletonLinkClientImplementation) {
    if (VITE_COMPILE_ELECTRON) {
      const LinkClientElectron = (await import('./linkClient.electron'))
        .LinkClientElectron
      AbletonLinkClientImplementation = LinkClientElectron
    } else {
      throw Error('Update implementation to class-based interface')
      // const LinkClientSocketIO = (await import('./linkClient.socket-io')).LinkClientSocketIO;
      // AbletonLinkClientImplementation = LinkClientSocketIO
    }
  }
  return AbletonLinkClientImplementation
}
