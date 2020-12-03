const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = function(config) {
    return merge(config, merge(common, {
        target: "electron-main"
    }))
};
