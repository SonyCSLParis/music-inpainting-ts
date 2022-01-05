const { merge } = require('webpack-merge')
const makeCommonConfiguration = require('./webpack.common.cjs')
const ESLintPlugin = require('eslint-webpack-plugin')

module.exports = function (config) {
  const commonConfiguration = makeCommonConfiguration({})
  return merge(
    config,
    merge(commonConfiguration, {
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
