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
    devtool: env.production ? false : 'inline-source-map',

    mode: env.production ? 'production' : 'development',

    plugins: [
      new webpack.DefinePlugin({
        COMPILE_ELECTRON: false,
        // allows to inline this expression to retrieve host details at runtime as default
        // FIXME(theis): retrieved value is empty in compiled Electron app
        REMOTE_INPAINTING_API_ADDRESS:
          env.default_inpainting_api_address != null
            ? JSON.stringify(env.default_inpainting_api_address)
            : JSON.stringify('https://api.cslmusic.team'),
        DEFAULT_CUSTOM_INPAINTING_API_ADDRESS: JSON.stringify(
          'http://localhost:'
        ),
        AVAILABLE_APPLICATION_MODES: JSON.stringify(applicationModes),
        ENABLE_ANONYMOUS_MODE: env.anonymous_mode,
        SPLASH_SCREEN_INSERT_EULA_AGREEMENT_CHECKBOX:
          env.splash_screen_insert_eula_agreement_checkbox != null,
        NO_SPLASH_SCREEN_INSERT_CUSTOM_API_ADDRESS_INPUT:
          env.no_splash_screen_insert_custom_api_address_input == null,
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
