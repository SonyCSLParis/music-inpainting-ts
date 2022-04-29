// webpack configuration for web, NOTONO-only interface

const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { merge, mergeWithCustomize, customizeArray } = require('webpack-merge')

const web = require('./webpack.web.cjs')

// DefinePlugin must be overridden by prepending since the inlining occurs
// in the order of apparition of the multiple instances of the plugin
let merged_defines = mergeWithCustomize({
  customizeArray: customizeArray({
    plugins: 'prepend',
  }),
})(web, {
  mode: 'production',

  devtool: false,

  plugins: [
    new webpack.DefinePlugin({
      AVAILABLE_APPLICATION_MODES: ['spectrogram'],
    }),
  ],
})

module.exports = merge(merged_defines, {
  plugins: [
    new HtmlWebpackPlugin({
      meta: {
        // Fixes 300ms delay on touch + reduce size on mobile for better display
        viewport:
          'width=device-width, initial-scale=0.5, maximum-scale=0.5, user-scalable=no, target-densityDpi=medium-dpi',
      },
      title: 'NOTONO',
      favicon: 'src/common/images/favicon.ico',
    }),
  ],
})
