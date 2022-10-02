// FIXME(@tbazin, 2022/09/24): use 'music-inpainting.ts' default
let VITE_APP_TITLE = process.env.VITE_APP_TITLE ?? 'music-inpainting-ts'
VITE_APP_TITLE = VITE_APP_TITLE.replace('.', '-')
let VITE_APP_VERSION = process.env.VITE_APP_VERSION

if (VITE_APP_VERSION == undefined) {
  const now = new Date()
  VITE_APP_VERSION = `${now.getUTCFullYear() - 2000}.${
    now.getUTCMonth() + 1
  }.${now.getUTCDate()}-${now.getUTCHours() * 60 + now.getUTCMinutes()}`
}

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  productName: VITE_APP_TITLE,
  directories: {
    output: 'dist',
    buildResources: 'buildResources',
  },
  files: ['packages/**/dist/**'],
  extraMetadata: {
    version: VITE_APP_VERSION,
  },
}

module.exports = config
