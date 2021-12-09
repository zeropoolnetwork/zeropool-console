const merge = require('webpack-merge').merge;
const common = require('./webpack.config.js');

common.module.rules = common.module.rules.filter(({ use }) => use !== 'ts-loader');

module.exports = merge(common, {
  devtool: false,
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts$/,
        enforce: 'pre',
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.prod.json'
        }
      }
    ],
  }
});
