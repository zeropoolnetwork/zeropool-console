require('dotenv').config();

const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge').merge;
const common = require('./webpack.config.js');

module.exports = merge(common, {
    mode: 'production',
    devServer: {
        contentBase: [path.join(__dirname, 'dist'), __dirname],
        compress: true,
        port: 3000,
        hot: true,
        writeToDisk: true,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    devtool: 'eval-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new webpack.EnvironmentPlugin({
            NETWORK: null,
            CONTRACT_ADDRESS: null,
            TOKEN_ADDRESS: null,
            RELAYER_URL: null,
            RPC_URL: null,
            TRANSACTION_URL: null,
        }),
    ]
});
