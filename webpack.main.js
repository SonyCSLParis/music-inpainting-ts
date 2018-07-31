let webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    target: "electron-main",
	context: __dirname + "/src/main",
    entry: './main.ts',
    output: {
      path: __dirname + '/app',
      filename: 'index.js'
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: 'index.html',
            filename: __dirname + '/app/index.html',
            title: 'DeepBach',
            favicon: '../common/images/favicon.ico',
            inject: false
        }),

        new CopyWebpackPlugin([
              {from: '../common/tonejs-instruments/samples/organ',
               to: 'tonejs-instruments/samples/organ'},
              {from: '../common/tonejs-instruments/samples/harmonium',
               to: 'tonejs-instruments/samples/harmonium'},
              {from: '../common/tonejs-instruments/samples/xylophone',
               to: 'tonejs-instruments/samples/xylophone'}
        ])
    ],

    externals: {
        abletonlink: "require('abletonlink')",
        nbind: "require('nbind')"
    }
});
