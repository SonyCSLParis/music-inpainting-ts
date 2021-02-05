import merge from 'webpack-merge'
import { Configuration } from 'webpack'
import * as common from './webpack.common.js'
import ESLintPlugin from 'eslint-webpack-plugin'

export default function(config) {
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
