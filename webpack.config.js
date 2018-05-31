var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = function (options) {
  return {
    entry: './index.ts',
    output: {
      path: __dirname + '/dist',
      filename: 'index.bundle.js'
    },

    // Currently we need to add '.ts' to the resolve.extensions array.
    resolve: {
      extensions: ['.ts', '.js', '.css', '.scss'],
      modules: ['node_modules', 'styles', '../opensheetmusicdisplay-fork']
    },

    // Source maps support ('inline-source-map' also works)
    devtool: 'source-map',

    // Add the loader for .ts files.
    module: {
      rules: [{
          test: /\.json$/,
          use: 'json-loader'
        },
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'awesome-typescript-loader',
              options: {
//                  configFileName: 'tsconfig.webpack.json'
		                  configFileName: 'tsconfig.json'
              }
            }
          ]
      },
      {
          test: /\.scss$/,
          use: [
              "style-loader", // creates style nodes from JS strings
              "css-loader", // translates CSS into CommonJS
              "sass-loader" // compiles Sass to CSS
          ]}
      ]
    },

    plugins: [
      new HtmlWebpackPlugin({
        title: 'DeepBach',
        favicon: 'images/favicon.ico'
      }),
	//example on how to add ressources
      new CopyWebpackPlugin([
        {
          from: 'Boplicity.xml',
          to: 'musicXmlSample.xml'
        }
      ])
    ],

    node: {
      global: true,
      crypto: 'empty',
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false
    }
  };
}
