// webpack configuration for web, NOTONO-only interface
// TODO(theis): disable inclusion of sound samples for this mode

let webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin');

const merge = require('webpack-merge');
const web = require('./webpack.web.js');

// DefinePlugin must be overriden by prepending since the inlining occurs
// in the order of apparition of the multiple instances of the plugin
merged_defines = merge.strategy(
    {plugins: 'prepend'}
)(web, {
    mode: 'production',

    devtool: false,

    plugins: [
        new webpack.DefinePlugin({
            'SPECTROGRAM_ONLY': true,
        }),
    ]
});

module.exports = merge(
    merged_defines,
    {
        plugins: [
            new HtmlWebpackPlugin({
                meta: {
                    // Fixes 300ms delay on touch + reduce size on mobile for better display
                    'viewport': "width=device-width, initial-scale=0.5, maximum-scale=1.0, user-scalable=no, target-densityDpi=medium-dpi"
                },
                title: 'NOTONO',
                favicon: 'src/common/images/favicon.ico'
        })]
    }
);
