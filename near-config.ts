export enum Environment {
  MainNet = 'mainnet',
  TestNet = 'testnet',
  BetaNet = 'betanet',
  ZeropoolTestNet = 'zerotestnet',
}

export class Config {
  networkId: string;
  nodeUrl: string;
  walletUrl?: string;
  helperUrl?: string;
  explorerUrl?: string;
  keyPath?: string;
  masterAccount?: string;
}

export function getConfig(env: Environment): Config {
  switch (env) {
    case Environment.MainNet:
      return {
        networkId: 'mainnet',
        nodeUrl: 'https://rpc.mainnet.near.org',
        walletUrl: 'https://wallet.near.org',
        helperUrl: 'https://helper.mainnet.near.org',
        explorerUrl: 'https://explorer.mainnet.near.org',
      }
    case Environment.TestNet:
      return {
        networkId: 'default',
        nodeUrl: 'https://rpc.testnet.near.org',
        walletUrl: 'https://wallet.testnet.near.org',
        helperUrl: 'https://helper.testnet.near.org',
        explorerUrl: 'https://explorer.testnet.near.org',
      }
    case Environment.BetaNet:
      return {
        networkId: 'betanet',
        nodeUrl: 'https://rpc.betanet.near.org',
        walletUrl: 'https://wallet.betanet.near.org',
        helperUrl: 'https://helper.betanet.near.org',
        explorerUrl: 'https://explorer.betanet.near.org',
      }
    case Environment.ZeropoolTestNet:
      return {
        networkId: 'default',
        nodeUrl: 'http://rpc.neardevnode.zeropool.network:3000/',
      }
    default:
      throw Error(`Unknown environment '${env}'.`)
  }
}
