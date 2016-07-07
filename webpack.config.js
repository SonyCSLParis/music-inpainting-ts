var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {

  entry: './index.ts',
  output: {
    path: './dist',
    filename: 'index.bundle.js'
  },

  // Currently we need to add '.ts' to the resolve.extensions array.
  resolve: {
    extensions: ['', '.ts', '.tsx', '.js', '.jsx']
  },

  // Source maps support ('inline-source-map' also works)
  devtool: 'source-map',

  // Add the loader for .ts files.
  module: {
    loaders: [
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'opensheetmusicdisplay | webpack-usage-example'
    }),
    new CopyWebpackPlugin([
      { 
        from: 'node_modules/opensheetmusicdisplay/test/data/MuzioClementi_SonatinaOpus36No1_Part1.xml', 
        to: 'musicXmlSample.xml' 
      }
    ])
  ]
};
