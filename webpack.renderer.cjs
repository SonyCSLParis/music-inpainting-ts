const webpack = require('webpack')
const { merge, mergeWithCustomize, customizeArray } = require('webpack-merge')
const makeCommonConfiguration = require('./webpack.common.cjs')
const ESLintPlugin = require('eslint-webpack-plugin')

module.exports = function (config) {
  const commonConfiguration = makeCommonConfiguration({})

  const finalConfiguration = merge(
    config,
    mergeWithCustomize({
      // must prepend 'plugins' in order for this configuration
      // to properly override e.g. DefinePlugins in the commonConfiguration
      customizeArray: customizeArray({
        plugins: 'prepend',
      }),
    })(commonConfiguration, {
      target:
        config.mode === 'production' ? 'electron-preload' : 'electron-renderer',

      devServer: {
        proxy: {
          // TODO(theis): create subtree /api in flask-server to group all commands together as e.g. /api/erase
          context: [
            '/erase',
            '/timerange-change',
            '/generate',
            '/get-midi',
            '/musicxml-to-midi',
            '/sample-from-dataset',
            '/get-audio',
            '/get-spectrogram-image',
            '/analyze-audio',
          ],
          // expects the inference model to be served locally on port 5000
          target: 'http://[::1]:5000',
        },
        // publicPath: 'static/'
      },

      output:
        config.mode === 'production' ? { filename: 'renderer.prod.js' } : {},

      plugins: [
        new webpack.DefinePlugin({
          COMPILE_ELECTRON: true,
        }),

        new ESLintPlugin({
          context: 'src/renderer',
          extensions: ['ts', 'tsx'],
          failOnError: false, // HACK(theis): should be true!
        }),
      ],
    })
  )
  return finalConfiguration
}
