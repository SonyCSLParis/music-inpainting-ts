let webpack = require('webpack')

module.exports = {
    plugins: [
        new webpack.DefinePlugin({
            'COMPILE_ELECTRON': true,
            // allows to inline this expression to retrieve host details at runtime as default
            'DEFAULT_SERVER_IP': '(window.location.hostname).replace("127.0.0.1", "localhost")',
            // defaults to communicating with the http-server for the flask server as well,
            // uses the proxy option of http-server
            'DEFAULT_SERVER_PORT': 'window.location.port',
            'ENABLE_ANONYMOUS_MODE': true,
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
};
