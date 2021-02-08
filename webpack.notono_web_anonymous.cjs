// webpack configuration for web, NOTONO-only interface
// TODO(theis): disable inclusion of sound samples for this mode

const webpack = require('webpack')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { merge, mergeWithCustomize, customizeArray } = require('webpack-merge')

const notono_web = require('./webpack.notono_web.cjs')

// DefinePlugin must be overridden by prepending since the inlining occurs
// in the order of apparition of the multiple instances of the plugin
const merged_defines = mergeWithCustomize({
    customizeArray: customizeArray({
        plugins: 'prepend'
    })
})(notono_web, {
    mode: 'production',

    plugins: [
        new webpack.DefinePlugin({
            'SPECTROGRAM_ONLY': true,
            'ENABLE_ANONYMOUS_MODE': true
        }),
    ]
});

module.exports = merge(
    merged_defines,
    {
        output: {
            path: path.join(__dirname, 'web/dist_anonymous'),
            filename: 'index.bundle.js'
        },

        plugins: [
            new HtmlWebpackPlugin({
                meta: {
                    // Fixes 300ms delay on touch + reduce size on mobile for better display
                    'viewport': "width=device-width, initial-scale=0.5, maximum-scale=1.0, user-scalable=no, target-densityDpi=medium-dpi"
                },
                title: 'NSynth Vector-Quantized Inpainting',
                favicon: 'src/common/images/favicon_spectrogram.ico'
        })]
    }
);
