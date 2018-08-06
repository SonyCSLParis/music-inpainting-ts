const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    // target: "electron-renderer",
	// context: __dirname + "/src/renderer",
    // entry: './index.ts',
    // output: {
    //   path: __dirname + '/app',
    //   filename: 'renderer.js'
    // },

});
