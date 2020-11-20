import BN from 'bn.js';
import { Account, WalletConnection, KeyPair, connect, Near } from 'near-api-js';
import { KeyStore, InMemoryKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome, JsonRpcProvider } from 'near-api-js/lib/providers';
import { GenesisConfig } from 'near-api-js/lib/providers/provider';
import { parseNearAmount } from 'near-api-js/lib/utils/format';
import { AccountBalance, AccountState } from 'near-api-js/lib/account';
import { transfer } from 'near-api-js/lib/transaction';
import { RequestManager, HTTPTransport, Client } from "@open-rpc/client-js";

import LocalAccount from './LocalAccount';
import { Config, Environment, getConfig } from './near-config';

export default class NearClient {
    private keyStore: KeyStore;
    readonly config: Config;
    public nearAccount: Account;
    public localAccount: LocalAccount;

    constructor(env: Environment) {
        this.keyStore = new InMemoryKeyStore();
        this.config = getConfig(env);
    }

    public isLoggedIn(): boolean {
        return this.localAccount && !this.localAccount.isLocked();
    }

    public async login(localAccount: LocalAccount) {
        localAccount.requireAuth();

        const privateKey = localAccount.getNearPrivateKey();
        const address = localAccount.getNearAddress();

        await this.keyStore.setKey(this.config.networkId, address, KeyPair.fromString(privateKey));

        const options = { ...this.config, deps: { keyStore: this.keyStore } };
        const near = await connect(options);
        this.localAccount = localAccount;
        this.nearAccount = await near.account(address);
    }

    public async transferNear(to: string, amount: string) {
        await this.nearAccount.sendMoney(to, new BN(amount));
    }

    public async getNearBalance(): Promise<AccountBalance> {
        return await this.nearAccount.getAccountBalance();
    }
}
