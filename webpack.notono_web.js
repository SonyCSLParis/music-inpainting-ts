// webpack configuration for web, NOTONO-only interface
// TODO(theis): disable inclusion of sound samples for this mode

let webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

const merge = require('webpack-merge');
const web = require('./webpack.web.js');

const my_merge = merge.strategy({
        plugins: 'prepend',
});

module.exports = my_merge(web, {
    mode: 'production',

    plugins: [
        new webpack.DefinePlugin({
            'SPECTROGRAM_ONLY': true,
            'DISABLE_SERVER_INPUT': true,
        }),
    ]
});
