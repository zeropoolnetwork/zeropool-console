import { CoinType } from 'zeropool-api-js';
import { generateMnemonic } from 'zeropool-api-js/lib/utils';
import Account from './account';

// const CHAIN_ID = NETWORK.toLowerCase();
// FIXME: temporary
const CHAIN_ID = 'ethereum';

export async function setSeed(seed: string, password: string) {
    await this.account.login(seed, password);
}

export function getSeed(password: string) {
    const seed = this.account.getSeed(password);
    this.echo(`[[;gray;]Seed phrase: ${seed}]`);
}

export function genSeed() {
    const seed = generateMnemonic();
    this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
}

export function getAddress(accountIndex: string) {
    const address = this.account.getRegularAddress(CHAIN_ID, parseInt(accountIndex));
    this.echo(`[[;gray;]Address: ${address}]`);
}

export function genShieldedAddress() {
    const address = this.account.getPrivateAddress(CHAIN_ID);
    this.echo(`[[;gray;]${address}]`);
}

export async function getPrivateKey(accountIndex: string, password: string) {
    const seed = await this.account.getRegularPrivateKey(CHAIN_ID, parseInt(accountIndex), password);
    this.echo(`[[;gray;]Private key: ${seed}]`);
}

export async function getBalance(accountIndex: string) {
    const [balance, readable] = await this.account.getBalance(CHAIN_ID as CoinType, parseInt(accountIndex));
    this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
}

export async function getPrivateBalance() {
    this.pause();
    const [total, acc, note] = await this.account.getPrivateBalances(CHAIN_ID as CoinType);
    this.echo(`[[;gray;]
Private balance:
    total: ${total} (account + note)
    account: ${acc}
    note: ${note}
]`);
    this.resume();
}

export async function getBalances() {
    const account: Account = this.account;
    const balances = await account.getBalances();
    let buf = '';

    for (const [coinType, coinBalances] of Object.entries(balances)) {
        buf += `    ${CoinType[coinType]}:\n`;

        for (const balance of coinBalances) {
            buf += `        ${balance.address}: ${balance.balance}\n`;
        }
    }

    this.echo(`Balances:\n${buf}`);
}

export async function getTokenBalance(accountIndex: string) {
    return this.account.getTokenBalance(CHAIN_ID, accountIndex);
}

export async function mint(accountIndex: string, amount: string) {
    return this.account.mint(CHAIN_ID, accountIndex, amount);
}

export async function transfer(accountIndex: string, to: string, amount: string) {
    await this.account.transfer(CHAIN_ID, parseInt(accountIndex), to, amount);
}

export async function transferPrivate(accountIndex: number, to: string, amount: string) {
    this.echo('Performing private transfer...');
    this.pause();
    await this.account.transferPrivate(CHAIN_ID, accountIndex, to, amount);
    this.resume();
    this.echo('Done');
}

export async function depositPrivate(accountIndex: string, amount: string) {
    this.echo('Performing private deposit...');
    this.pause();
    await this.account.depositPrivate(CHAIN_ID, parseInt(accountIndex), amount);
    this.resume();
    this.echo('Done');
}

export async function withdrawPrivate(accountIndex: string, amount: string) {
    this.echo('Performing private withdraw...');
    this.pause();
    await this.account.withdrawPrivate(CHAIN_ID, parseInt(accountIndex), amount);
    this.resume();
    this.echo('Done');
}

export function clear() {
    this.clear();
}

export function reset() {
    this.account = null;
    this.reset();
}

export async function showState() {
    const account: Account = this.account;
    const coin = account.hdWallet.getCoin(CoinType.ethereum)!;
    await coin.updatePrivateState();
    const data = coin.zpState.account.getWholeState();
    console.log(data);

    for (const [index, tx] of data.txs) {
        this.echo(`${index}: ${JSON.stringify(tx)}`);
    }
}
