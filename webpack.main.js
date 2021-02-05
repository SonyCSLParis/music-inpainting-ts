const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = function(config) {
    return merge(config, merge(common, {
        target: "electron-main",

        plugins: [
            new ESLintPlugin({
                context: 'src/main',
                extensions: ['ts', 'tsx'],
            }),
        ]
    }))
};
