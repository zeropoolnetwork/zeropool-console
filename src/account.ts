import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import { EthereumClient, PolkadotClient, Client as NetworkClient, NearClient, WavesClient } from 'zeropool-support-js';
import { init, NearNetwork, ZeropoolClient } from 'zeropool-client-js';
import { zp } from 'zeropool-client-js/lib/zp';
import bip39 from 'bip39-light';
import HDWalletProvider from '@truffle/hdwallet-provider';
import { deriveSpendingKey } from 'zeropool-client-js/lib/utils';
import { NetworkType } from 'zeropool-client-js/lib/network-type';
import { EvmNetwork } from 'zeropool-client-js/lib/networks/evm';
import { PolkadotNetwork } from 'zeropool-client-js/lib/networks/polkadot';
import { ChainId } from 'zeropool-support-js/lib/networks/waves/config';
import { WavesNetwork } from 'zeropool-client-js/lib/networks/waves';
import BN from 'bn.js';

const WORKER_ST_PATH = '/workerSt.js?' + process.env.CACHE_BUST
const WORKER_MT_PATH = '/workerMt.js?' + process.env.CACHE_BUST

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
      window.NETWORK = process.env.NETWORK;
      window.CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
      window.TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
      window.RELAYER_URL = process.env.RELAYER_URL;
      window.RPC_URL = process.env.RPC_URL;
      window.TRANSACTION_URL = process.env.TRANSACTION_URL;
      window.DELEGATED_DEPOSITS_ADDRESS = process.env.DELEGATED_DEPOSITS_ADDRESS;
    }
  }

  public async init(mnemonic: string, password: string): Promise<void> {
    const snarkParamsConfig = {
      transferParamsUrl: './assets/transfer_params.bin',
      treeParamsUrl: './assets/tree_params.bin',
      transferVkUrl: './assets/transfer_verification_key.json',
      treeVkUrl: './assets/tree_verification_key.json',
    };

    const { worker, snarkParams } = await init(snarkParamsConfig, {
      workerSt: WORKER_ST_PATH,
      workerMt: WORKER_MT_PATH,
    });

    let client, network;
    if (isEvmBased(NETWORK)) {
      const provider = new HDWalletProvider({
        mnemonic,
        providerOrUrl: RPC_URL,
      });
      client = new EthereumClient(provider, { transactionUrl: TRANSACTION_URL, ddStorageAddress: DELEGATED_DEPOSITS_ADDRESS });
      network = new EvmNetwork(RPC_URL);
    } else if (isSubstrateBased(NETWORK)) {
      client = await PolkadotClient.create(mnemonic, { rpcUrl: RPC_URL, transactionUrl: TRANSACTION_URL });
      network = new PolkadotNetwork();
    } else if (NETWORK === 'near') {
      client = await NearClient.create(
        {
          networkId: 'testnet', // TODO: Make it configurable
          nodeUrl: RPC_URL,
        },
        CONTRACT_ADDRESS,
        mnemonic,
      );
      network = new NearNetwork(RELAYER_URL);
    } else if (NETWORK === 'waves') {
      // TODO: Make it configurable
      client = new WavesClient(CONTRACT_ADDRESS, mnemonic, { nodeUrl: RPC_URL, chainId: ChainId.Testnet });
      network = new WavesNetwork(RPC_URL, CONTRACT_ADDRESS);
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

  public async getShieldedBalance(): Promise<bigint> {
    return this.zpClient.getOptimisticTotalBalance(TOKEN_ADDRESS);;
  }

  public async getBalance(): Promise<[string, string]> {
    const balance = await this.client.getBalance();
    const readable = this.client.fromBaseUnit(balance);

    return [balance, readable];
  }

  public async getInternalState(): Promise<any> {
    return this.zpClient.rawState(TOKEN_ADDRESS);
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

  public getTransactionUrl(txHash: string): string {
    return this.client.getTransactionUrl(txHash);
  }

  public async transferShielded(to: string, amount: string): Promise<void> {
    console.log('Making transfer...');
    const jobId = await this.zpClient.transfer(TOKEN_ADDRESS, [{ to, amount }]);

    this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId).then(() => {
      console.log('Job %s completed', jobId);
    });;
  }

  public async depositDelegated(to: string, amount: string): Promise<void> {
    const { d, p_d } = zp.parseAddress(to);

    const receiverD = new BN(d).toArrayLike(Buffer, 'be', 10);
    const receiverP = new BN(p_d).toArrayLike(Buffer, 'be', 32);

    await this.client.approve(TOKEN_ADDRESS, DELEGATED_DEPOSITS_ADDRESS, amount);
    await this.client.depositDelegated(TOKEN_ADDRESS, receiverD, receiverP, amount);
  }

  public async depositShielded(amount: string): Promise<void> {
    let fromAddress = null;
    if (isSubstrateBased(NETWORK)) {
      fromAddress = await this.client.getPublicKey();
    }

    if (isEvmBased(NETWORK)) {
      console.log('Approving allowance the Pool (%s) to spend our tokens (%s)', CONTRACT_ADDRESS, amount);
      await this.client.approve(TOKEN_ADDRESS, CONTRACT_ADDRESS, amount);
    }

    console.log('Making deposit...');
    const jobId = await this.zpClient.deposit(TOKEN_ADDRESS, BigInt(amount), (data) => this.client.sign(data), fromAddress, BigInt(0), []);

    this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId).then(() => {
      console.log('Job %s completed', jobId);
    });
  }

  public async withdrawShielded(amount: string): Promise<void> {
    let address = null;
    if (isEvmBased(NETWORK)) {
      address = await this.client.getAddress();
    }

    if (isSubstrateBased(NETWORK)) {
      address = await this.client.getPublicKey();
    }

    console.log('Making withdraw...');
    const jobId = await this.zpClient.withdraw(TOKEN_ADDRESS, address, BigInt(amount));

    this.zpClient.waitJobCompleted(TOKEN_ADDRESS, jobId).then(() => {
      console.log('Job %s completed', jobId);
    });;
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
