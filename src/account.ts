import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import { EthereumClient, PolkadotClient, Client as NetworkClient } from 'zeropool-support-js';
import { init, ZeropoolClient } from 'zeropool-client-js';
import bip39 from 'bip39-light';
import HDWalletProvider from '@truffle/hdwallet-provider';
import { deriveSpendingKey } from 'zeropool-client-js/lib/utils';
import { NetworkType } from 'zeropool-client-js/lib/network-type';

const wasmPath = new URL('npm:libzeropool-rs-wasm-web/libzeropool_rs_wasm_bg.wasm', import.meta.url);
const workerPath = new URL('npm:zeropool-client-js/lib/worker.js', import.meta.url);

interface AccountStorage {
    get(accountName: string, field: string): string | null;
    set(accountName: string, field: string, value: string);
}

class LocalAccountStorage implements AccountStorage {
    get(accountName: string, field: string): string | null {
        return localStorage.getItem(`zconsole.${accountName}.${field}`);
    }
    set(accountName: string, field: string, value: string) {
        localStorage.setItem(`zconsole.${accountName}.${field}`, value);
    }
}

// TODO: Extract timeout management code
export default class Account {
    readonly accountName: string;
    private storage: AccountStorage;
    public client: NetworkClient;
    private zpClient: ZeropoolClient;

    constructor(accountName: string) {
        this.accountName = accountName;
        this.storage = new LocalAccountStorage();

        if (process.env.NODE_ENV === 'development') {
            NETWORK = process.env.NETWORK.toLowerCase();
            CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
            TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
            RELAYER_URL = process.env.RELAYER_URL;
            RPC_URL = process.env.RPC_URL;
        }

    }

    public async init(mnemonic: string, password: string): Promise<void> {
        const snarkParamsConfig = {
            transferParamsUrl: './assets/transfer_params.bin',
            treeParamsUrl: './assets/tree_update_params.bin',
            transferVkUrl: './assets/transfer_verification_key.json',
            treeVkUrl: './assets/tree_update_verification_key.json',
        };

        const { worker, snarkParams } = await init(wasmPath.toString(), workerPath.toString(), snarkParamsConfig);
        let compactSignature = true;

        if (NETWORK === 'polkadot' || NETWORK === 'kusama') {
            compactSignature = false;
            snarkParamsConfig.transferParamsUrl = './assets/transfer_verification_key.bin';
            snarkParamsConfig.treeVkUrl = './assets/tree_update_verification_key.bin';
        }

        let client;
        if (['ethereum', 'aurora', 'xdai'].includes(NETWORK)) {
            const provider = new HDWalletProvider({
                mnemonic,
                providerOrUrl: RPC_URL,
                addressIndex: 0
            });
            client = new EthereumClient(provider);
        } else if (['polkadot', 'kusama'].includes(NETWORK)) {
            client = PolkadotClient.create(mnemonic, RPC_URL);
        }

        const networkType = NETWORK as NetworkType;
        const sk = deriveSpendingKey(mnemonic, networkType);
        this.client = client;
        this.zpClient = await ZeropoolClient.create({
            sk,
            worker,
            snarkParams,
            tokens: {
                [TOKEN_ADDRESS]: {
                    poolAddress: CONTRACT_ADDRESS,
                    relayerUrl: RELAYER_URL,
                }
            },
            networkName: NETWORK,
            compactSignature,
        });

        this.storage.set(this.accountName, 'seed', await AES.encrypt(mnemonic, password).toString());
    }

    public async unlockAccount(password: string) {
        let seed = this.decryptSeed(password);
        this.init(seed, password);
    }

    public isAccountPresent(): boolean {
        return !!this.storage.get(this.accountName, 'seed');
    }

    public getRegularAddress(): string {
        return this.client.getAddress();
    }


    public async getShieldedBalances(): Promise<[string, string, string]> {
        const balances = this.zpClient.getBalances(TOKEN_ADDRESS);

        return balances;
    }

    public async getBalance(): Promise<[string, string]> {
        const balance = await this.client.getBalance();
        const readable = this.client.fromBaseUnit(balance);

        return [balance, readable];
    }

    // TODO: Support multiple tokens
    public async getTokenBalance(): Promise<string> {
        return await this.client.getTokenBalance(TOKEN_ADDRESS);
    }

    public async mint(amount: string): Promise<void> {
        await this.client.mint(TOKEN_ADDRESS, amount);
    }

    public async transfer(to: string, amount: string): Promise<void> {
        await this.client.transfer(to, amount);
    }

    // TODO: account number is temporary, it should not be needed when using a relayer
    public async transferShielded(to: string, amount: string): Promise<void> {
        await this.zpClient.transfer(TOKEN_ADDRESS, [{ to, amount }]);
    }

    public async depositShielded(amount: string): Promise<void> {
        await this.zpClient.deposit(TOKEN_ADDRESS, amount, async (_data) => 'FIXME');
    }

    public async withdrawShielded(amount: string): Promise<void> {
        const address = this.getRegularAddress();
        await this.zpClient.withdraw(TOKEN_ADDRESS, address, amount);
    }

    private decryptSeed(password: string): string {
        const cipherText = this.storage.get(this.accountName, 'seed');
        let seed;
        try {
            seed = AES.decrypt(cipherText, password).toString(Utf8);
            if (!bip39.validateMnemonic(seed)) throw new Error('invalid mnemonic');
        } catch (_) {
            throw new Error('Incorrect password');
        }

        return seed;
    }
}
