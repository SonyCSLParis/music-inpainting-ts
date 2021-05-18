const webpack = require('webpack')

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      COMPILE_ELECTRON: true,
      // allows to inline this expression to retrieve host details at runtime as default
      // FIXME(theis): retrieved value is empty in compiled Electron app
      DEFAULT_INPAINTING_API_IP:
        '(window.location.hostname).replace("127.0.0.1", "localhost")',
      // default to communicating with the Flask server on the same port as the window
      // FIXME(theis): retrieved value is empty in compiled Electron app
      DEFAULT_INPAINTING_API_PORT: 'window.location.port',
      INPAINTING_API_USE_HTTPS: false,
      SPECTROGRAM_ONLY: false,
      ENABLE_ANONYMOUS_MODE: false,
    }),

    new webpack.ProvidePlugin({
      // this allows to use JQuery plugin by calling `require('plugin-name')`
      // as it provides a global JQuery
      // TODO(theis, maybe): alternative method
      // http://reactkungfu.com/2015/10/integrating-jquery-chosen-with-webpack-using-imports-loader/
      $: 'jquery',
      jQuery: 'jquery',
      'window.$': 'jquery',
      'window.jQuery': 'jquery',
    }),
  ],
}
