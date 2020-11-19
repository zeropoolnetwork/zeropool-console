import BN from 'bn.js';
import { Account, WalletConnection, KeyPair, connect, Near } from 'near-api-js';
import { KeyStore, InMemoryKeyStore } from 'near-api-js/lib/key_stores';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
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
    public rpc: NearRpcClient;
    public localAccount: LocalAccount;

    constructor(env: Environment) {
        this.keyStore = new InMemoryKeyStore();
        this.config = getConfig(env);
        this.rpc = new NearRpcClient(this.config.nodeUrl);
    }

    public isLoggedIn(): boolean {
        return this.localAccount && !this.localAccount.isLocked();
    }

    public async login() {
        this.localAccount.requireAuth();

        const privateKey = this.localAccount.getNearPrivateKey();
        const address = this.localAccount.getNearAddress();

        await this.keyStore.setKey(this.config.networkId, address, KeyPair.fromString(privateKey));
    }

    public async transferNear(to: string, amount: string) {
        // await this.nearAccount.sendMoney(to, new BN(amount));
    }

    // Taken from https://github.com/near/near-api-js/blob/8fa8780ab2bdfc85d63835088b89fa81ac10a920/src/account.ts#L422
    public async getNearBalance(): Promise<AccountBalance> {
        const state = await this.rpc.fetchAccountData(this.localAccount.getNearAddress());
        const genesisConfig = await this.rpc.fetchExperimentalGenesisConfig();

        const costPerByte = new BN(genesisConfig.runtime_config.storage_amount_per_byte);
        const stateStaked = new BN(state.storage_usage).mul(costPerByte);
        const staked = new BN(state.locked);
        const totalBalance = new BN(state.amount).add(staked);
        const availableBalance = totalBalance.sub(BN.max(staked, stateStaked));

        return {
            total: totalBalance.toString(),
            stateStaked: stateStaked.toString(),
            staked: staked.toString(),
            available: availableBalance.toString()
        };
    }
}

class NearRpcClient {
    private url: string;
    private client: Client;

    constructor(url: string) {
        this.url = url;
        const transport = new HTTPTransport(url);
        this.client = new Client(new RequestManager([transport]));
    }

    async fetchAccountData(accountId: string): Promise<AccountState> {
        return await this.client.request({
            method: 'query',
            params: {
                request_type: 'view_account',
                account_id: accountId,
                finality: 'final',
            }
        });
    }

    async fetchExperimentalGenesisConfig(): Promise<GenesisConfig> {
        return await this.client.request({ method: 'EXPERIMENTAL_genesis_config' });
    }
}
