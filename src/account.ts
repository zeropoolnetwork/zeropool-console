import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import bcrypt from 'bcryptjs';
import { HDWallet, CoinType, Balance, devConfig, prodConfig, init } from 'zeropool-api-js';
// @ts-ignore
import wasmPath from 'libzeropool-rs-wasm-web/libzeropool_rs_wasm_bg.wasm';
// @ts-ignore
import workerPath from 'zeropool-api-js/lib/worker.js?asset';
import { Config } from 'zeropool-api-js/lib/config';

import transferParamsUrl from '../assets/tx_params.bin';
import treeParamsUrl from '../assets/tree_params.bin';
import transferVk from '../assets/tx_vk.json';
import treeVk from '../assets/tree_vk.json';

import addresses from '../deps/pool-evm-single-l1/addresses.json';

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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

const ENABLED_COINS = [CoinType.ethereum];

export enum Env {
    Prod = 'prod',
    Dev = 'dev',
}

// TODO: Extract timeout management code
export default class Account {
    private lockTimeout?: ReturnType<typeof setTimeout>;
    readonly accountName: string;
    private storage: AccountStorage;
    public hdWallet: HDWallet;
    private config: Config;

    constructor(accountName: string, env: Env) {
        this.accountName = accountName;
        this.storage = new LocalAccountStorage();

        switch (env) {
            case Env.Prod:
                this.config = prodConfig;
                break;
            case Env.Dev:
                this.config = devConfig;
                break;
        }

        this.config.ethereum.contractAddress = addresses.pool;
        this.config.ethereum.tokenContractAddress = addresses.token;
        this.config.ethereum.httpProviderUrl = 'http://127.0.0.1:8545';

        this.config.snarkParams.transferParamsUrl = transferParamsUrl;
        this.config.snarkParams.treeParamsUrl = treeParamsUrl;
        this.config.snarkParams.transferVk = transferVk;
        this.config.snarkParams.treeVk = treeVk;
        // @ts-ignore
        this.config.wasmPath = wasmPath;
        this.config.workerPath = workerPath;
    }

    public async init(): Promise<void> {
        await init(wasmPath);
    }

    public async login(seed: string, password: string) {
        this.storage.set(this.accountName, 'seed', await AES.encrypt(seed, password).toString());
        this.storage.set(this.accountName, 'pwHash', await bcrypt.hash(password, await bcrypt.genSalt(10)));
        this.hdWallet = await HDWallet.init(seed, this.config, ENABLED_COINS);

        // this.setAccountTimeout(LOCK_TIMEOUT);
    }

    public isAccountPresent(): boolean {
        return !!this.storage.get(this.accountName, 'pwHash');
    }

    public getSeed(password: string): string {
        this.checkPassword(password);

        return this.decryptSeed(password);
    }

    public async unlockAccount(password: string) {
        this.checkPassword(password);

        const seed = this.decryptSeed(password);
        this.hdWallet = await HDWallet.init(seed, this.config, ENABLED_COINS);
        console.log('done');
    }

    public checkPassword(password: String) {
        const hash = this.storage.get(this.accountName, 'pwHash');

        if (!bcrypt.compare(hash, password)) {
            throw new Error('Incorrect password');
        }

        // this.setAccountTimeout(LOCK_TIMEOUT);
    }

    public isLocked(): boolean {
        return !this.hdWallet;
    }

    public requireAuth() {
        if (this.isLocked()) {
            throw Error('Account is locked. Unlock the account first');
        }

        // this.setAccountTimeout(LOCK_TIMEOUT);
    }

    public getRegularAddress(chainId: string, account: number = 0): string {
        this.requireAuth();

        const coin = this.hdWallet.getCoin(chainId as CoinType);

        return coin.getAddress(account);
    }

    public getPrivateAddress(chainId: string): string {
        this.requireAuth();

        const coin = this.hdWallet.getCoin(chainId as CoinType);

        return coin.generatePrivateAddress();
    }

    public async getRegularPrivateKey(chainId: string, accountIndex: number, password: string): Promise<string> {
        await this.unlockAccount(password);

        const coin = this.hdWallet.getCoin(chainId as CoinType);

        return coin.getPrivateKey(accountIndex);
    }

    public async getBalances(): Promise<{ [key in CoinType]?: Balance[] }> {
        this.requireAuth();

        return this.hdWallet.getBalances(5);
    }

    public async getPrivateBalances(chainId: CoinType): Promise<[string, string, string]> {
        this.requireAuth();
        const coin = this.hdWallet.getCoin(chainId);
        await coin.updatePrivateState();
        const balances = await coin.getPrivateBalances();

        return balances;
    }

    public async getBalance(chainId: CoinType, account: number = 0): Promise<[string, string]> {
        this.requireAuth();
        const coin = this.hdWallet.getCoin(chainId);
        const balance = await coin.getBalance(account);
        const readable = await coin.fromBaseUnit(balance);

        return [balance, readable];
    }

    public async transfer(chainId: string, account: number, to: string, amount: string): Promise<void> {
        this.requireAuth();

        const coin = this.hdWallet.getCoin(chainId as CoinType);
        await coin.transfer(account, to, amount);
    }


    // TODO: account number is temporary, it should not be needed when using a relayer
    public async transferPrivate(chainId: string, account: number, to: string, amount: string): Promise<void> {
        this.requireAuth();

        const coin = this.hdWallet.getCoin(chainId as CoinType);
        await coin.updatePrivateState();
        await coin.transferPrivateToPrivate(account, [{ to, amount }]);
    }

    public async depositPrivate(chainId: string, account: number, amount: string): Promise<void> {
        this.requireAuth();

        const coin = this.hdWallet.getCoin(chainId as CoinType);
        await coin.updatePrivateState();
        await coin.depositPrivate(account, amount);
    }

    public async withdrawPrivate(chainId: string, account: number, amount: string): Promise<void> {
        this.requireAuth();

        const coin = this.hdWallet.getCoin(chainId as CoinType);
        await coin.updatePrivateState();
        await coin.withdrawPrivate(account, amount);
    }

    private setAccountTimeout(ms: number) {
        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout);
        }

        this.lockTimeout = setTimeout(function () {
            this.seed = null;
        }, ms);
    }

    private decryptSeed(password: string): string {
        const cipherText = this.storage.get(this.accountName, 'seed');
        const seed = AES.decrypt(cipherText, password).toString(Utf8);

        return seed;
    }
}
