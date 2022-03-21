import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import { EthereumClient, PolkadotClient, Client as NetworkClient } from 'zeropool-support-js';
import { init, ZeropoolClient } from 'zeropool-client-js';
import bip39 from 'bip39-light';
import HDWalletProvider from '@truffle/hdwallet-provider';
import { deriveSpendingKey } from 'zeropool-client-js/lib/utils';
import { NetworkType } from 'zeropool-client-js/lib/network-type';
import { EvmNetwork } from 'zeropool-client-js/lib/networks/evm';
import { PolkadotNetwork } from 'zeropool-client-js/lib/networks/polkadot';

// @ts-ignore
import wasmPath from 'libzeropool-rs-wasm-web/libzeropool_rs_wasm_bg.wasm';
// @ts-ignore
import workerPath from 'zeropool-client-js/lib/worker.js?asset';
// const wasmPath = new URL('npm:libzeropool-rs-wasm-web/libzeropool_rs_wasm_bg.wasm', import.meta.url);
// const workerPath = new URL('npm:zeropool-client-js/lib/worker.js', import.meta.url);

function isEvmBased(network: string): boolean {
    return ['ethereum', 'aurora', 'xdai'].includes(network);
}

function isSubstrateBased(network: string): boolean {
    return ['polkadot', 'kusama'].includes(network);
}

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
            console.log('Dev environment, using local env variables.');
            NETWORK = process.env.NETWORK;
            CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
            TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
            RELAYER_URL = process.env.RELAYER_URL;
            RPC_URL = process.env.RPC_URL;
        }
    }

    public async init(mnemonic: string, password: string): Promise<void> {
        const snarkParamsConfig = {
            transferParamsUrl: './assets/transfer_params.bin',
            treeParamsUrl: './assets/tree_params.bin',
            transferVkUrl: './assets/transfer_verification_key.json',
            treeVkUrl: './assets/tree_verification_key.json',
        };

        let compactSignature = true;
        if (isSubstrateBased(NETWORK)) {
            compactSignature = false;
        }

        const { worker, snarkParams } = await init(wasmPath, workerPath, snarkParamsConfig);

        let client, network;
        if (isEvmBased(NETWORK)) {
            const provider = new HDWalletProvider({
                mnemonic,
                providerOrUrl: RPC_URL,
            });
            client = new EthereumClient(provider);
            network = new EvmNetwork(RPC_URL);
        } else if (isSubstrateBased(NETWORK)) {
            client = await PolkadotClient.create(mnemonic, RPC_URL);
            network = new PolkadotNetwork();
        } else {
            throw new Error(`Unknown network ${NETWORK}`);
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
            network,
        });

        this.storage.set(this.accountName, 'seed', await AES.encrypt(mnemonic, password).toString());
    }

    public async unlockAccount(password: string) {
        let seed = this.decryptSeed(password);
        await this.init(seed, password);
    }

    public getSeed(password: string): string {
        return this.decryptSeed(password);
    }

    public isInitialized(): boolean {
        return !!this.client;
    }

    public isAccountPresent(): boolean {
        return !!this.storage.get(this.accountName, 'seed');
    }

    public async getRegularAddress(): Promise<string> {
        return await this.client.getAddress();
    }

    public genShieldedAddress(): string {
        return this.zpClient.generateAddress(TOKEN_ADDRESS);
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
s
    public async transferShielded(to: string, amount: string): Promise<string> {
        console.log('Making transfer...');
        const jobId = await this.zpClient.transfer(TOKEN_ADDRESS, [{ to, amount }]);
        console.log('Please wait relayer complete the job %s...', jobId);

        return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
    }

    public async depositShielded(amount: string): Promise<string> {
        let fromAddress = null;
        if (isSubstrateBased(NETWORK)) {
            fromAddress = await this.client.getPublicKey();
        }

        if (isEvmBased(NETWORK)) {
            console.log('Approving allowance the Pool (%s) to spend our tokens (%s)', CONTRACT_ADDRESS, amount);
            await this.client.approve(TOKEN_ADDRESS, CONTRACT_ADDRESS, amount);
        }

        console.log('Making deposit...');
        const jobId = await this.zpClient.deposit(TOKEN_ADDRESS, amount, (data) => this.client.sign(data), fromAddress);
        console.log('Please wait relayer complete the job %s...', jobId);

        return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
    }

    public async withdrawShielded(amount: string): Promise<string> {

        let address = null;
        if (isEvmBased(NETWORK)) {
            address = await this.client.getAddress();
        }

        if (isSubstrateBased(NETWORK)) {
            address = await this.client.getPublicKey();
        }

        console.log('Making withdraw...');
        const jobId = await this.zpClient.withdraw(TOKEN_ADDRESS, address, amount);
        console.log('Please wait relayer complete the job %s...', jobId);

        return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
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
