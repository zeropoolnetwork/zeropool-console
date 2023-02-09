const path = require('path');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin').CleanWebpackPlugin;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');


module.exports = {
    mode: 'development',
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle-[hash].js',
        publicPath: './',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            'http': require.resolve('stream-http'),
            'https': require.resolve('https-browserify'),
            'crypto': require.resolve('crypto-browserify'),
            'os': require.resolve('os-browserify/browser'),
            'path': require.resolve('path-browserify'),
            'assert': require.resolve('assert'),
            'constants': require.resolve('constants-browserify'),
            'fs': false,
        },
        alias: {
            process: 'process/browser.js',
            stream: 'stream-browserify',
        }
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.js$/,
                enforce: 'pre',
                use: ['source-map-loader'],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyPlugin({
            patterns: [
                { from: 'src/env.js' },
                { from: '*', context: 'build-workers' }
            ],
        }),
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            filename: 'index.html',
            minify: {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
            },
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process'
        }),
        new webpack.DefinePlugin({
            'process.env.CACHE_BUST': JSON.stringify(new Date().getTime()),
        }),
    ],
    ignoreWarnings: [/Failed to parse source map/],
};
