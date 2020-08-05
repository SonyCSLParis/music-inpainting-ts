const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = function(config) {
    const styleRules = config.module.rules.filter(rule =>
      rule.test.toString().match(/css|less|s\(\[ac\]\)ss/)
    )

    styleRules.forEach(rule => {
      const cssLoader = rule.use.find(use => use.loader === 'css-loader')
      cssLoader.options.modules.type = 'icss'
    })

    return merge.smart(merge(common, {
      target: "electron-preload",

      devServer: {
        proxy: {
          // TODO(theis): create subtree /api in flask-server to group all commands together as e.g. /api/erase
          context: ['/erase', '/timerange-change', '/sample-from-dataset', '/get-audio', '/get-spectrogram-image'],
          // expects the inference model to be served locally on port 5000
          target: "http://[::1]:5000"
        }
      },

      output: (process.env.NODE_ENV === 'production' ? {filename: 'renderer.prod.js'} : {}),
    }), config)
  };
