/* eslint-env node */

import { chrome } from '../../.electron-vendors.cache.json'
import path, { join } from 'path'
import { builtinModules } from 'module'

const PACKAGE_ROOT = __dirname

console.log(PACKAGE_ROOT)
console.log(
  path.resolve(PACKAGE_ROOT, '../../node_modules/webmidi/dist/esm/') + '/'
)

const VITE_COMPILE_WEB = process.env.VITE_COMPILE_WEB != undefined
const VITE_APP_TITLE =
  process.env.VITE_APP_TITLE != undefined
    ? process.env.VITE_APP_TITLE
    : 'VITE_APP'

const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml: (html: string): string => {
      const updateTitle = html.replace(
        /<title>(.*?)<\/title>/,
        `<title>${VITE_APP_TITLE}</title>`
      )
      return updateTitle
    },
  }
}

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  resolve: {
    alias: {
      '/@/': join(PACKAGE_ROOT, 'src') + '/',
      '/@webmidiESM/':
        path.resolve(
          PACKAGE_ROOT,
          '../../node_modules/webmidi/dist/esm/webmidi.esm.js'
        ) + '/',
    },
  },
  plugins: [htmlPlugin()],
  base: '',
  server: {
    fs: {
      strict: true,
    },
  },
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: './assets/',
    rollupOptions: {
      input: join(PACKAGE_ROOT, 'index.html'),
      external: VITE_COMPILE_WEB
        ? []
        : [...builtinModules.flatMap((p) => [p, `node:${p}`])],
    },
    emptyOutDir: true,
    brotliSize: false,
  },
  test: {
    environment: 'happy-dom',
  },
}

export default config
