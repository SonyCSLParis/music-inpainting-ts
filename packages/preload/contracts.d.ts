/* eslint-disable @typescript-eslint/consistent-type-imports */
interface Exposed {
  readonly abletonLinkApi: Readonly<import('./src/abletonLinkApi').IAbletonApi>
  readonly ipcRendererInterface: Readonly<
    typeof import('./src/ipcRendererInterface').ipcRendererInterface
  >
  // readonly electronShell: Readonly<typeof import('electron').shell>
  readonly global: typeof globalThis
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Window extends Exposed {}
