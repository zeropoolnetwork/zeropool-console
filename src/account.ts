import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import { HDWallet, NetworkType, Balance, init } from 'zeropool-api-js';
import { Config } from 'zeropool-api-js/lib/config';
import bip39 from 'bip39-light';

const wasmPath = new URL('npm:libzeropool-rs-wasm-web/libzeropool_rs_wasm_bg.wasm', import.meta.url);
const workerPath = new URL('npm:zeropool-api-js/lib/worker.js', import.meta.url);

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
    public hdWallet: HDWallet;
    private config: Config;

    constructor(accountName: string) {
        this.accountName = accountName;
        this.storage = new LocalAccountStorage();

        if (process.env.NODE_ENV === 'development') {
            NETWORK = process.env.NETWORK;
            CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
            TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
            RELAYER_URL = process.env.RELAYER_URL;
            EVM_RPC = process.env.EVM_RPC;
        }

        const networkId = NETWORK.toLowerCase() as NetworkType;
        if (!(networkId in NetworkType)) {
            throw new Error(`Unknown network ID: ${networkId}`);
        }

        this.config = {
            snarkParams: {
                transferParamsUrl: './assets/transfer_params.bin',
                treeParamsUrl: './assets/tree_update_params.bin',
                transferVkUrl: './assets/transfer_verification_key.json',
                treeVkUrl: './assets/tree_update_verification_key.json',
            },
            networks: {
                [networkId]: {
                    httpProviderUrl: EVM_RPC,
                    tokens: {
                        [TOKEN_ADDRESS]: {
                            poolAddress: CONTRACT_ADDRESS,
                            relayerUrl: RELAYER_URL,
                            denominator: BigInt(1000000000),
                        }
                    }
                }
            },
            wasmPath: wasmPath.toString(),
            workerPath: workerPath.toString(),
        };
    }

    public async init(): Promise<void> {
        await init(wasmPath);
    }

    public async login(seed: string, password: string, beforeLoad: () => void) {
        this.storage.set(this.accountName, 'seed', await AES.encrypt(seed, password).toString());
        await this.unlockAccount(password, beforeLoad);
    }

    public isAccountPresent(): boolean {
        return !!this.storage.get(this.accountName, 'seed');
    }

    public getSeed(password: string): string {
        return this.decryptSeed(password);
    }

    public async unlockAccount(password: string, beforeLoad: () => void) {
        const seed = this.decryptSeed(password);
        if (this.hdWallet) {
            this.hdWallet.free();
            this.hdWallet = null;
        }

        beforeLoad();
        this.hdWallet = await HDWallet.init(seed, this.config);
    }

    public getRegularAddress(chainId: string, account: number): string {
        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        return network.getAddress(account);
    }

    public getPrivateAddress(chainId: string): string {
        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        return network.generatePrivateAddress();
    }

    public async getRegularPrivateKey(chainId: string, accountIndex: number, password: string): Promise<string> {
        this.decryptSeed(password);

        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        return network.getPrivateKey(accountIndex);
    }

    public async getBalances(): Promise<{ [key in NetworkType]?: Balance[] }> {
        return this.hdWallet.getBalances(5);
    }

    public async getShieldedBalances(chainId: NetworkType): Promise<[string, string, string]> {
        const network = this.hdWallet.getNetwork(chainId);
        await network.updateState();
        const balances = network.getShieldedBalances();

        return balances;
    }

    public async getBalance(chainId: NetworkType, account: number): Promise<[string, string]> {
        const network = this.hdWallet.getNetwork(chainId);
        const balance = await network.getBalance(account);
        const readable = network.fromBaseUnit(balance);

        return [balance, readable];
    }

    // TODO: Support multiple tokens
    public async getTokenBalance(chainId: NetworkType, account: number): Promise<string> {
        const network = this.hdWallet.getNetwork(chainId);
        const balance = await network.getTokenBalance(account, TOKEN_ADDRESS);
        return balance;
    }

    public async mint(chainId: NetworkType, account: number, amount: string): Promise<void> {
        const network = this.hdWallet.getNetwork(chainId);
        await network.mint(account, TOKEN_ADDRESS, amount);
    }

    public async transfer(chainId: string, account: number, to: string, amount: string): Promise<void> {
        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        await network.transfer(account, to, amount);
    }

    // TODO: account number is temporary, it should not be needed when using a relayer
    public async transferShielded(chainId: string, to: string, amount: string): Promise<void> {
        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        await network.updateState();
        await network.transferShielded(TOKEN_ADDRESS, [{ to, amount }]);
    }

    public async depositShielded(chainId: string, account: number, amount: string): Promise<void> {
        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        await network.updateState();
        await network.depositShielded(account, TOKEN_ADDRESS, amount);
    }

    public async withdrawShielded(chainId: string, account: number, amount: string): Promise<void> {
        const network = this.hdWallet.getNetwork(chainId as NetworkType);
        await network.updateState();
        await network.withdrawShielded(account, TOKEN_ADDRESS, amount);
    }

    private decryptSeed(password: string): string {
        const cipherText = this.storage.get(this.accountName, 'seed');
        let seed;
        try {
            seed = AES.decrypt(cipherText, password).toString(Utf8);
            if (!bip39.validateMnemonic(seed)) throw new Error();
        } catch (_) {
            throw new Error('Incorrect password');
        }

        return seed;
    }
}
