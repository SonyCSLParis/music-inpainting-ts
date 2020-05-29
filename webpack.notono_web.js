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
            'INSERT_RECAPTCHA': true,
            'RECAPTCHA_SITEKEY': JSON.stringify('6Leab_MUAAAAAP7_u_MTF96FH0-8kLtfNTZiD3yu'),
            'RECAPTCHA_VERIFICATION_ADDRESS': JSON.stringify('http://ec2-63-33-36-17.eu-west-1.compute.amazonaws.com:8081/verify')
        }),

        new HtmlWebpackPlugin({
            template: 'src/common/template.html',
            title: 'NOTONO',
            favicon: 'src/common/images/favicon.ico'
        }),
    ]
});
