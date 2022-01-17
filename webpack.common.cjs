const webpack = require('webpack')
const log = require('loglevel')

const validApplicationModes = ['chorale', 'spectrogram', 'leadsheet', 'folk']
const defaultApplicationModes = ['chorale', 'spectrogram']
const validateApplicationMode = (mode) => validApplicationModes.includes(mode)

module.exports = function (env) {
  const applicationModesNonValidated =
    env.application_modes != null
      ? env.application_modes.split(',').map((mode) => mode.toLowerCase())
      : defaultApplicationModes
  const applicationModes = applicationModesNonValidated.filter(
    validateApplicationMode
  )

  if (applicationModesNonValidated.length != applicationModes.length) {
    const invalidApplicationModes = applicationModesNonValidated.filter(
      (mode) => !validateApplicationMode(mode)
    )
    log.error(
      'Some invalid application modes were provided: ',
      invalidApplicationModes
    )
  }

  if (!(Array.isArray(applicationModes) && applicationModes.length > 0)) {
    throw EvalError('Must enable at least one valid application mode')
  }

  return {
    mode: env.production ? 'production' : 'development',

    plugins: [
      new webpack.DefinePlugin({
        COMPILE_ELECTRON: false,
        // allows to inline this expression to retrieve host details at runtime as default
        // FIXME(theis): retrieved value is empty in compiled Electron app
        DEFAULT_INPAINTING_API_ADDRESS:
          env.default_inpainting_api_address != null
            ? JSON.stringify(env.default_inpainting_api_address)
            : "'http://' + (window.location.hostname).replace('127.0.0.1', 'localhost') + ':' + (window.location.port)",
        AVAILABLE_APPLICATION_MODES: JSON.stringify(applicationModes),
        ENABLE_ANONYMOUS_MODE: env.anonymous_mode,
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
}
