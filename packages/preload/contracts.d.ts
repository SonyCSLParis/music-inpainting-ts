/* eslint-disable @typescript-eslint/consistent-type-imports */

interface Exposed {
  readonly ipcRenderer: Readonly<typeof import('electron').ipcRenderer>
  readonly electronShell: Readonly<typeof import('electron').shell>
  readonly global: typeof globalThis
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Window extends Exposed {}
