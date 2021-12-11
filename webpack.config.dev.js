
const merge = require('webpack-merge').merge;
const common = require('./webpack.config.js');

module.exports = merge(common, {
  mode: 'production',
  devServer: {
    contentBase: 'dist',
    compress: true,
    port: 3000,
    writeToDisk: true,
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
  }
});
