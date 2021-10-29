import { CoinType } from 'zeropool-api-js';
import { generateMnemonic } from 'zeropool-api-js/lib/utils';
import Account from './account';

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

export function getAddress(chainId: string, accountIndex: string = '0') {
    const address = this.account.getRegularAddress(chainId, parseInt(accountIndex));
    this.echo(`[[;gray;]Address: ${address}]`);
}

export function genPrivateAddress(chainId: string) {
    const address = this.account.getPrivateAddress(chainId);
    this.echo(`[[;gray;]${address}]`);
}

export async function getPrivateKey(chainId: string, accountIndex: string, password: string) {
    const seed = await this.account.getRegularPrivateKey(chainId, parseInt(accountIndex), password);
    this.echo(`[[;gray;]Private key: ${seed}]`);
}

export async function getBalance(chainId: string, accountIndex: string = '0') {
    const [balance, readable] = await this.account.getBalance(chainId as CoinType, parseInt(accountIndex));
    this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
}

export async function getPrivateBalance(chainId: string) {
    const [total, acc, note] = await this.account.getPrivateBalances(chainId as CoinType);
    this.echo(`[[;gray;]Private balance (total, account, notes): ${total} (${acc} + ${note})]`);
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

export async function transfer(chainId: string, accountIndex: string, to: string, amount: string) {
    await this.account.transfer(chainId, parseInt(accountIndex), to, amount);
}

export async function transferPrivate(chainId: string, accountIndex: number, to: string, amount: string) {
    this.echo('Performing private transfer...');
    await this.account.transferPrivate(chainId, accountIndex, to, amount);
    this.echo('Done');
}

export async function depositPrivate(chainId: string, accountIndex: string, amount: string) {
    this.echo('Performing private deposit...');
    await this.account.depositPrivate(chainId, parseInt(accountIndex), amount);
    this.echo('Done');
}

export async function withdrawPrivate(chainId: string, accountIndex: string, amount: string) {
    this.echo('Performing private withdraw...');
    await this.account.withdrawPrivate(chainId, parseInt(accountIndex), amount);
    this.echo('Done');
}

export async function unlock(password) {
    await this.account.unlockAccount(password);
}

export function clear() {
    this.clear();
}

export function reset() {
    this.account = null;
    this.reset();
}
