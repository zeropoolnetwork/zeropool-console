import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import { EthereumClient, PolkadotClient, Client as NetworkClient } from 'zeropool-support-js';
import { init, ZkBobClient, HistoryRecord, TxAmount } from 'zkbob-client-js';
import bip39 from 'bip39-light';
import HDWalletProvider from '@truffle/hdwallet-provider';
import { deriveSpendingKey } from 'zkbob-client-js/lib/utils';
import { NetworkType } from 'zkbob-client-js/lib/network-type';
import { EvmNetwork } from 'zkbob-client-js/lib/networks/evm';
import { PolkadotNetwork } from 'zkbob-client-js/lib/networks/polkadot';

const DEFAULT_FEE = "0";

// @ts-ignore
import wasmPath from 'libzkbob-rs-wasm-web/libzkbob_rs_wasm_bg.wasm';
// @ts-ignore
import workerPath from 'zkbob-client-js/lib/worker.js?asset';
// const wasmPath = new URL('npm:libzeropool-rs-wasm-web/libzeropool_rs_wasm_bg.wasm', import.meta.url));
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
    private zpClient: ZkBobClient;

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
            TRANSACTION_URL = process.env.TRANSACTION_URL;
            TOKEN_SYMBOL = process.env.TOKEN_SYMBOL;
            SHIELDED_TOKEN_SYMBOL = process.env.SHIELDED_TOKEN_SYMBOL;
        }
    }

    public async init(mnemonic: string, password: string): Promise<void> {
        const snarkParamsConfig = {
            transferParamsUrl: './assets/transfer_params.bin',
            treeParamsUrl: './assets/tree_params.bin',
            transferVkUrl: './assets/transfer_verification_key.json',
            treeVkUrl: './assets/tree_verification_key.json',
        };

        const { worker, snarkParams } = await init(wasmPath, workerPath, snarkParamsConfig);

        let client, network;
        if (isEvmBased(NETWORK)) {
            const provider = new HDWalletProvider({
                mnemonic,
                providerOrUrl: RPC_URL,
            });
            client = new EthereumClient(provider, { transactionUrl: TRANSACTION_URL });
            network = new EvmNetwork(RPC_URL);
        } else if (isSubstrateBased(NETWORK)) {
            client = await PolkadotClient.create(mnemonic, { rpcUrl: RPC_URL, transactionUrl: TRANSACTION_URL });
            network = new PolkadotNetwork();
        } else {
            throw new Error(`Unknown network ${NETWORK}`);
        }

        const networkType = NETWORK as NetworkType;
        const sk = deriveSpendingKey(mnemonic, networkType);
        this.client = client;
        this.zpClient = await ZkBobClient.create({
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

    public async getOptimisticTotalBalance(): Promise<string> {
        const pendingBalance = this.zpClient.getOptimisticTotalBalance(TOKEN_ADDRESS);

        return pendingBalance;
    }

    public async getBalance(): Promise<[string, string]> {
        const balance = await this.client.getBalance();
        const readable = this.client.fromBaseUnit(balance);

        return [balance, readable];
    }

    public async getInternalState(): Promise<any> {
        return this.zpClient.rawState(TOKEN_ADDRESS);
    }

    public async getAllHistory(): Promise<HistoryRecord[]> {
        return this.zpClient.getAllHistory(TOKEN_ADDRESS);
    }

    public async cleanInternalState(): Promise<void> {
        return this.zpClient.cleanState(TOKEN_ADDRESS);
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

    public async getTxParts(amount: string, fee: string): Promise<Array<TxAmount>> {
        return await this.zpClient.getTransactionParts(TOKEN_ADDRESS, amount, fee);
    }

    public getTransactionUrl(txHash: string): string {
        return this.client.getTransactionUrl(txHash);
    }

    public async transferShielded(to: string, amount: string): Promise<string[]> {
        console.log('Waiting while state become ready...');
        const ready = await this.zpClient.waitReadyToTransact(TOKEN_ADDRESS);
        if (ready) {
            console.log('Making transfer...');
            //const jobId = await this.zpClient.transfer(TOKEN_ADDRESS, [{ to, amount }]);
            const jobIds = await this.zpClient.transferMulti(TOKEN_ADDRESS, to, amount, DEFAULT_FEE);
            console.log('Please wait relayer complete the jobs [%s]...', jobIds.join(", "));

            const waiters = jobIds.map(async (jobId) => {
                return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
            });

            return await Promise.all(waiters);
            
        } else {
            console.log('Sorry, I cannot wait anymore. Please ask for relayer 😂');

            throw Error('State is not ready for transact');
        }
    }

    public async depositShielded(amount: string): Promise<string> {
        let fromAddress = null;
        if (isSubstrateBased(NETWORK)) {
            fromAddress = await this.client.getPublicKey();
        }

        if (isEvmBased(NETWORK)) {
            console.log('Approving allowance the Pool (%s) to spend our tokens (%s)', CONTRACT_ADDRESS, amount);
            const totalApproveAmount = (BigInt(amount) + BigInt(DEFAULT_FEE)) * BigInt(1000000000);
            await this.client.approve(TOKEN_ADDRESS, CONTRACT_ADDRESS, totalApproveAmount.toString());
        }

        console.log('Waiting while state become ready...');
        const ready = await this.zpClient.waitReadyToTransact(TOKEN_ADDRESS);
        if (ready) {
            console.log('Making deposit...');
            const jobId = await this.zpClient.deposit(TOKEN_ADDRESS, amount, (data) => this.client.sign(data), fromAddress, DEFAULT_FEE);
            console.log('Please wait relayer complete the job %s...', jobId);

            return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
        } else {
            console.log('Sorry, I cannot wait anymore. Please ask for relayer 😂');

            return 'FAILED';
        }
    }

    private async createPermittableDepositData(tokenAddress: string, version: string, owner: string, spender: string, value: bigint, deadline: bigint) {
        const tokenName = await this.client.getTokenName(tokenAddress);
        const chainId = await this.client.getChainId();
        const nonce = await this.client.getTokenNonce(tokenAddress);

        const domain = {
            name: tokenName,
            version: version,
            chainId: chainId,
            verifyingContract: tokenAddress,
        };

        const types = {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Permit: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
              { name: "value", type: "uint256" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" }
            ],
        };

        const message = { owner, spender, value: value.toString(), nonce, deadline: deadline.toString() };

        const data = { types, primaryType: "Permit", domain, message };

        return data;
    }

    public async depositShieldedPermittable(amount: string): Promise<string> {
        let myAddress = null;
        if (isEvmBased(NETWORK)) {
            myAddress = await this.client.getAddress();
        } else {
            throw Error('Permittable token deposit is supported on the EVM networks only');
        }
        
        console.log('Waiting while state become ready...');
        const ready = await this.zpClient.waitReadyToTransact(TOKEN_ADDRESS);
        if (ready) {
            console.log('Making deposit...');
            const jobId = await this.zpClient.depositPermittable(TOKEN_ADDRESS, amount, async (deadline, value) => {
                const dataToSign = await this.createPermittableDepositData(TOKEN_ADDRESS, '1', myAddress, CONTRACT_ADDRESS, value, deadline);
                return this.client.signTypedData(dataToSign)
            }, myAddress, DEFAULT_FEE);

            console.log('Please wait relayer complete the job %s...', jobId);

            return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
        } else {
            console.log('Sorry, I cannot wait anymore. Please ask for relayer 😂');

            return 'FAILED';
        }
    }

    public async withdrawShielded(amount: string, external_addr: string): Promise<string[]> {

        let address = null;
        if (external_addr == null) {
            if (isEvmBased(NETWORK)) {
                address = await this.client.getAddress();
            }

            if (isSubstrateBased(NETWORK)) {
                address = await this.client.getPublicKey();
            }
        } else {
            address = external_addr;
        }

        console.log('Waiting while state become ready...');
        const ready = await this.zpClient.waitReadyToTransact(TOKEN_ADDRESS);
        if (ready) {
            console.log('Making withdraw...');
            const jobIds = await this.zpClient.withdrawMulti(TOKEN_ADDRESS, address, amount, DEFAULT_FEE);
            console.log('Please wait relayer complete the jobs [%s]...', jobIds.join(", "));

            const waiters = jobIds.map(async (jobId) => {
                return await this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId);
            });

            return await Promise.all(waiters);

        } else {
            console.log('Sorry, I cannot wait anymore. Please ask for relayer 😂');

            throw Error('State is not ready for transact');
        }
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
