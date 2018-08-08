 let webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    // Currently we need to add '.ts' to the resolve.extensions array.
    resolve: {
      extensions: ['.ts', '.js', '.css', '.scss'],
      modules: ['node_modules', 'styles', '../opensheetmusicdisplay',
        './tonejs-instruments'],
      symlinks: true
    },

    plugins: [
        new webpack.ProvidePlugin({
        // this allows to use JQuery plugin by calling `require('plugin-name')`
        // as it provides a global JQuery
        // TODO(theis, maybe): alternative method
        // http://reactkungfu.com/2015/10/integrating-jquery-chosen-with-webpack-using-imports-loader/
            $: 'jquery',
            jQuery: 'jquery'
        }),
    ],

    node: {
      crypto: 'empty',
      module: false,
      clearImmediate: false,
      setImmediate: false,
      __dirname: false,  // false has __dirname resolve to the directory of the output file
      __filename: false
    }
  };
