const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ESLintPlugin = require('eslint-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { mergeWithCustomize, customizeArray } = require('webpack-merge')

const makeCommonConfiguration = require('./webpack.common.cjs')

// Webpack --env parameters are retrieved in module.exports' first argument
// see: https://webpack.js.org/guides/environment-variables/
module.exports = function (env) {
  const commonConfiguration = makeCommonConfiguration(env)

  return mergeWithCustomize({
    // must prepend 'plugins' in order for this configuration
    // to properly override e.g. DefinePlugins in the commonConfiguration
    customizeArray: customizeArray({
      plugins: 'prepend',
    }),
  })(commonConfiguration, {
    target: 'web',

    entry: './src/renderer/index.ts',

    output: {
      path: path.join(__dirname, 'web/dist'),
      filename: 'index.bundle.js',
    },

    // Currently we need to add '.ts' to the resolve.extensions array.
    resolve: {
      extensions: ['.ts', '.js', '.css', '.scss', '.json'],
      modules: ['node_modules', 'styles', './tonejs-instruments', 'src/common'],
      // exclude: ['**/*.electron.ts'],
      symlinks: true,
      alias: {
        common: path.resolve(__dirname, 'src/common'),
      },
    },

    // Source maps support ('inline-source-map' also works)
    devtool: 'source-map',

    module: {
      rules: [
        {
          // loader for .ts files.
          test: /\.tsx?$/,
          loader: 'ts-loader',
          exclude: path.resolve(__dirname, 'node_modules'),
        },
        {
          test: /\.(css|scss)$/,
          use: [
            'style-loader', // creates style nodes from JS strings
            'css-loader', // translates CSS into CommonJS
            'sass-loader', // compiles Sass to CSS
          ],
        },
        {
          test: /\.(png|svg|jpg|gif)$/,
          use: ['file-loader'],
        },
        // the url-loader uses DataUrls.
        // the file-loader emits files.
        {
          test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          // Limiting the size of the woff fonts breaks font-awesome ONLY for the extract text plugin
          // loader: "url?limit=10000"
          use: 'url-loader',
        },
        {
          test: /\.(ttf|eot|svg)(\?[\s\S]+)?$/,
          use: 'file-loader',
        },
      ],
    },

    plugins: [
      new ESLintPlugin({
        context: 'src/renderer',
        extensions: ['ts', 'tsx'],
        failOnError: false, // HACK(theis): should be true!
      }),

      new HtmlWebpackPlugin({
        meta: {
          // Fixes 300ms delay on touch + reduce size on mobile for better display
          viewport:
            'width=device-width, initial-scale=0.5, maximum-scale=1.0, user-scalable=no, target-densityDpi=medium-dpi',
        },
        title: env.app_title != null ? env.app_title : 'NONOTO / NOTONO',
        favicon: 'src/common/images/favicon.ico',
      }),

      new webpack.ProvidePlugin({
        // this allows to use JQuery plugin by calling `require('plugin-name')`
        // as it provides a global JQuery
        // TODO(theis, maybe): alternative method
        // http://reactkungfu.com/2015/10/integrating-jquery-chosen-with-webpack-using-imports-loader/
        $: 'jquery',
        jQuery: 'jquery',
      }),

      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'static'),
            to: 'static',
          },
        ],
      }),
    ],

    node: {
      global: true,
      crypto: 'empty',
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false,
    },
  })
}
