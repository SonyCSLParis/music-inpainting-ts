/* eslint-env node */

import { chrome } from '../../.electron-vendors.cache.json'
import path, { join } from 'path'
import { builtinModules } from 'module'
import { HtmlTagDescriptor, IndexHtmlTransformHook, UserConfig } from 'vite'

const PACKAGE_ROOT = __dirname

const VITE_DEPLOYMENT_URL =
  process.env.VITE_DEPLOYMENT_URL != undefined
    ? new URL(process.env.VITE_DEPLOYMENT_URL).href
    : undefined
const VITE_COMPILE_WEB = process.env.VITE_COMPILE_WEB != undefined
const VITE_APP_TITLE =
  process.env.VITE_APP_TITLE != undefined
    ? process.env.VITE_APP_TITLE
    : 'VITE_APP'

function makeOpenGraphData(): HtmlTagDescriptor[] {
  let tags: Map<string, string>
  if (!VITE_COMPILE_WEB) {
    return []
  }
  if (VITE_APP_TITLE.toLowerCase() == 'notono') {
    tags = new Map([
      [
        'og:title',
        'NOTONO: AI-assisted visual transformation of musical sounds',
      ],
      [
        'og:description',
        'Let your visual thinking draw new sounds. An AI-based interface for inpainting of musical sounds, developed at Sony CSL Paris.',
      ],
      ['og:type', 'website'],
      ['og:url', VITE_DEPLOYMENT_URL || ''],
      [
        'og:image',
        new URL('notono-preview-20220511-1200_630.jpg', VITE_DEPLOYMENT_URL)
          .href,
      ],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', 'An screenshot of the NOTONO interface is shown.'],
    ])
  } else if (VITE_APP_TITLE.toLowerCase() == 'nonoto') {
    tags = new Map([
      [
        'og:title',
        'NONOTO+DeepBach: AI-assisted interactive generation of chorale music by inpainting',
      ],
      [
        'og:description',
        'Easily create polyphonic music with just the tip of your finger, all in your browser. Developed at Sony CSL Paris.',
      ],
      ['og:type', 'website'],
      ['og:url', VITE_DEPLOYMENT_URL || ''],
      [
        'og:image',
        new URL('nonoto-preview-20220511-1200_630.jpg', VITE_DEPLOYMENT_URL)
          .href,
      ],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', 'An screenshot of the NONOTO interface is shown.'],
    ])
  }
  const toTag = ([attrType, content]: [string, string]): HtmlTagDescriptor => {
    const attrs = {}
    attrs['property'] = attrType
    attrs['content'] = content
    return { tag: 'meta', attrs: attrs }
  }
  return Array.from(tags.entries()).map(toTag)
}

const indexHtmlTransformHook: IndexHtmlTransformHook = (html, ctx) => {
  html = html.replace(
    /<title>(.*?)<\/title>/,
    `<title>${VITE_APP_TITLE}</title>`
  )
  const faviconTag = {
    tag: 'link',
    attrs: {
      rel: 'shortcut icon',
      href: new URL('favicon.ico', VITE_DEPLOYMENT_URL).href,
    },
  }
  const tags: HtmlTagDescriptor[] = [
    faviconTag,
    ...makeOpenGraphData(),
  ]
  return { html: html, tags: tags }
}

const htmlPlugin = () => {
  return {
    name: 'html-transform',
    transformIndexHtml: indexHtmlTransformHook,
  }
}

/**
 * @type {import('vite').UserConfig}
 * @see https://vitejs.dev/config/
 */
const config: UserConfig = {
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
  publicDir: './public',
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir:
      'dist' + (VITE_COMPILE_WEB ? '-' + VITE_APP_TITLE.toLowerCase() : ''),
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
