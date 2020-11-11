import BN from 'bn.js';
import { Account, WalletConnection, KeyPair, connect } from 'near-api-js';
import { KeyStore, BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { parseNearAmount } from 'near-api-js/lib/utils/format';
import { AccountBalance } from 'near-api-js/lib/account';
import { Mnemonic, HDKey } from 'wallet.ts';

import { Config, Environment, getConfig } from './near-config';

const LOCAL_STORAGE_KEY_PREFIX = 'zeropool:keystore';
const BIP32_PATH = "m/44'/397'/0'/0";

export class NearClient {
  readonly config: Config;
  private keyStore: KeyStore;
  account: Account;

  constructor(env: Environment) {
    this.keyStore = new BrowserLocalStorageKeyStore(window.localStorage, LOCAL_STORAGE_KEY_PREFIX);
    this.config = getConfig(env);
  }

  public async login(accountId: string, privateKey?: string) {
    if (privateKey) {
      await this.keyStore.setKey(this.config.networkId, accountId, KeyPair.fromString(privateKey));
    } else {
      // Just ensure that the key exists
      const pair = await this.keyStore.getKey(this.config.networkId, accountId);

      if (!pair) {
        throw new Error(`Key pair for ${accountId} not found`);
      }
    }

    const options = { ...this.config, deps: { keyStore: this.keyStore } };
    const near = await connect(options);
    this.account = await near.account(accountId);
  }

  public async loginWithMnemonic(accountId: string, words?: string[], password?: string) {
    if (!words || words.length == 0) {
      await this.login(accountId);
      return;
    }

    const mnemonic = new Mnemonic(null, words);
    const seed = await mnemonic.toSeedAsync(password);
    const key = HDKey.parseMasterSeed(seed);
    const privateKey = key.derive(BIP32_PATH).extendedPrivateKey;

    await this.login(accountId, privateKey);
  }

  public async transfer(receiverId: string, amount: string): Promise<FinalExecutionOutcome> {
    return await this.account.sendMoney(receiverId, new BN(parseNearAmount(amount)));
  }

  public async getBalance(): Promise<AccountBalance> {
    return this.account.getAccountBalance();
  }
}
