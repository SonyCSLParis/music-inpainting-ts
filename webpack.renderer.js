const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = function(config) {
    const styleRules = config.module.rules.filter(rule =>
      rule.test.toString().match(/css|less|s\(\[ac\]\)ss/)
    )

    styleRules.forEach(rule => {
      const cssLoader = rule.use.find(use => use.loader === 'css-loader')
      cssLoader.options.modules = false
    })

    return merge.smart(common, config)
  };
