const { merge } = require('webpack-merge')
const common = require('./webpack.common.cjs')
const ESLintPlugin = require('eslint-webpack-plugin')

module.exports = function (config) {
  return merge(
    config,
    merge(common, {
      target: 'electron-main',

      plugins: [
        new ESLintPlugin({
          context: 'src/main',
          extensions: ['ts', 'tsx'],
          failOnError: false, // HACK(theis): should be true!
        }),
      ],
    })
  )
}
