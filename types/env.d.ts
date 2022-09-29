/// <reference types="vite/client" />

/**
 * Describes all existing environment variables and their types.
 * Required for Code completion and type checking
 *
 * Note: To prevent accidentally leaking env variables to the client, only variables prefixed with `VITE_` are exposed to your Vite-processed code
 *
 * @see https://github.com/vitejs/vite/blob/cab55b32de62e0de7d7789e8c2a1f04a8eae3a3f/packages/vite/types/importMeta.d.ts#L62-L69 Base Interface
 * @see https://vitejs.dev/guide/env-and-mode.html#env-files Vite Env Variables Doc
 */
interface ImportMetaEnv {
  /**
   * The value of the variable is set in scripts/watch.js and depend on packages/main/vite.config.js
   */
  readonly VITE_DEV_SERVER_URL: undefined | string
  readonly VITE_COMPILE_ELECTRON: undefined | string
  readonly VITE_APP_TITLE: undefined | string
  readonly VITE_REMOTE_INPAINTING_API_ADDRESS_BASE: undefined | string
  readonly VITE_PIA_INPAINTING_API_ADDRESS: undefined | string
  readonly VITE_DEFAULT_CUSTOM_INPAINTING_API_ADDRESS: undefined | string
  readonly VITE_NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT:
    | undefined
    | string
  readonly VITE_SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX: undefined | string
  // TODO SET VALUE AT BUILD TIME
  readonly VITE_AVAILABLE_APPLICATION_MODES: undefined | string
  readonly VITE_ENABLE_ANONYMOUS_MODE: undefined | string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
