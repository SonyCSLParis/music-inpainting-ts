/* eslint-disable @typescript-eslint/consistent-type-imports */
interface Exposed {
  readonly abletonLinkApi: Readonly<
    import('./src/abletonLinkApi').IAbletonLinkApi
  >
  readonly ipcRendererInterface: Readonly<
    typeof import('./src/ipcRendererInterface').ipcRendererInterface
  >
  readonly global: typeof globalThis
  electronWindowId: number
}

interface Window extends Exposed {}
