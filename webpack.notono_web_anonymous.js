// webpack configuration for web, NOTONO-only interface
// TODO(theis): disable inclusion of sound samples for this mode

import webpack from 'webpack'
import path from 'path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import merge from 'webpack-merge'

import notono_web from './webpack.notono_web.js'

// DefinePlugin must be overridden by prepending since the inlining occurs
// in the order of apparition of the multiple instances of the plugin
let merged_defines = merge.strategy(
    {plugins: 'prepend'}
)(notono_web, {
    mode: 'production',

    plugins: [
        new webpack.DefinePlugin({
            'SPECTROGRAM_ONLY': true,
            'ENABLE_ANONYMOUS_MODE': true
        }),
    ]
});

export default merge(
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
