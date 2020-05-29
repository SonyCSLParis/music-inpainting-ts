let webpack = require('webpack');
let path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge.smartStrategy({plugins: 'prepend',})(common, {
    mode: 'development',

    target: 'web',

    entry: './src/renderer/index.ts',

    output: {
        path: path.join(__dirname, 'web/dist'),
        filename: 'index.bundle.js'
    },

    // Currently we need to add '.ts' to the resolve.extensions array.
    resolve: {
        extensions: ['.ts', '.js', '.css', '.scss'],
        modules: ['node_modules', 'styles', '../opensheetmusicdisplay',
        './tonejs-instruments', 'src/common'],
      // exclude: ['**/*.electron.ts'],
        symlinks: true,
        alias: {
            common: path.resolve(__dirname, 'src/common')
        }
    },

    // Source maps support ('inline-source-map' also works)
    devtool: 'source-map',

    // Add the loader for .ts files.
    module: {
        rules: [{
            test: /\.ts$/,
            use: [{loader: 'ts-loader'}]
        },
        {
            test: /\.(css|scss)$/,
            use: [
                "style-loader", // creates style nodes from JS strings
                "css-loader", // translates CSS into CommonJS
                "sass-loader" // compiles Sass to CSS
            ]
        },
        {
            test: /\.(png|svg|jpg|gif)$/,
            use: [
                'file-loader'
            ]
        },
        // the url-loader uses DataUrls.
        // the file-loader emits files.
        {
            test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            // Limiting the size of the woff fonts breaks font-awesome ONLY for the extract text plugin
            // loader: "url?limit=10000"
            use: "url-loader"
        },
        {
            test: /\.(ttf|eot|svg)(\?[\s\S]+)?$/,
            use: 'file-loader'
        }
    ]},

    plugins: [
        new webpack.DefinePlugin({
            COMPILE_ELECTRON: false
        }),

        new HtmlWebpackPlugin({
            template: 'src/common/template.html',
            title: 'DeepBach',
            favicon: 'src/common/images/favicon.ico'
        }),
        new webpack.ProvidePlugin({
            // this allows to use JQuery plugin by calling `require('plugin-name')`
            // as it provides a global JQuery
            // TODO(theis, maybe): alternative method
            // http://reactkungfu.com/2015/10/integrating-jquery-chosen-with-webpack-using-imports-loader/
            $: 'jquery',
            jQuery: 'jquery'
        }),
        //example on how to add ressources
        new CopyWebpackPlugin([
            // {from: path.join(__dirname, 'src/renderer/tonejs-instruments/samples/organ'),
            //  to: 'tonejs-instruments/samples/organ'},
            //  {from: path.join(__dirname, 'src/renderer/tonejs-instruments/samples/xylophone'),
            //  to: 'tonejs-instruments/samples/xylophone'},
            {
                from: path.join(__dirname, 'static'),
                to: 'static'
            }
        ])
    ],

    node: {
        global: true,
        crypto: 'empty',
        process: true,
        module: false,
        clearImmediate: false,
        setImmediate: false
    }
});
