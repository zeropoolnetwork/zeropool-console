import BN from 'bn.js';
import { Account, WalletConnection, KeyPair, connect } from 'near-api-js';
import { KeyStore, BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { parseNearAmount } from 'near-api-js/lib/utils/format';
import { AccountBalance } from 'near-api-js/lib/account';

import LocalAccount from './LocalAccount';
import { Config, Environment, getConfig } from './near-config';

const LOCAL_STORAGE_KEY_PREFIX = 'zconsole.keystore';

export default class NearClient {
    private keyStore: KeyStore;
    readonly config: Config;
    public nearAccount: Account;
    public localAccount: LocalAccount;

    constructor(env: Environment) {
        this.keyStore = new BrowserLocalStorageKeyStore(window.localStorage, LOCAL_STORAGE_KEY_PREFIX);
        this.config = getConfig(env);
    }

    public isLoggedIn(): boolean {
        return !this.localAccount.isLocked();
    }

    public login(accountName: string, password: string, phrase?: string) {

    }

    public transfer(from: string, to: string, amount: string) {

    }
}
