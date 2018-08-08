let webpack = require('webpack')
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    externals: {
        // stops webpack from trying to bundle ableton-link, which is a external
        // native dependency
        abletonlink: "require('abletonlink')"
    }
});
