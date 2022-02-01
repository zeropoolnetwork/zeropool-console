import { NetworkType } from 'zeropool-api-js';
import { generateMnemonic } from 'zeropool-api-js/lib/utils';
import Account from './account';

function chainId(): NetworkType {
    return NETWORK.toLowerCase() as NetworkType;
}

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
    const address = this.account.getRegularAddress(chainId(), parseInt(accountIndex));
    this.echo(`[[;gray;]Address: ${address}]`);
}

export function genShieldedAddress() {
    const address = this.account.getPrivateAddress(chainId());
    this.echo(`[[;gray;]${address}]`);
}

export async function getPrivateKey(accountIndex: string, password: string) {
    const seed = await this.account.getRegularPrivateKey(chainId(), parseInt(accountIndex), password);
    this.echo(`[[;gray;]Private key: ${seed}]`);
}

export async function getBalance(accountIndex: string) {
    const [balance, readable] = await this.account.getBalance(chainId() as NetworkType, parseInt(accountIndex));
    this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
}

export async function getShieldedBalance() {
    this.pause();
    const [total, acc, note] = await this.account.getShieldedBalances(chainId() as NetworkType);
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
        buf += `    ${NetworkType[coinType]}:\n`;

        for (const balance of coinBalances) {
            buf += `        ${balance.address}: ${balance.balance}\n`;
        }
    }

    this.echo(`Balances:\n${buf}`);
}

export async function getTokenBalance(accountIndex: string) {
    return this.account.getTokenBalance(chainId(), accountIndex);
}

export async function mint(accountIndex: string, amount: string) {
    return this.account.mint(chainId(), accountIndex, amount);
}

export async function transfer(accountIndex: string, to: string, amount: string) {
    await this.account.transfer(chainId(), parseInt(accountIndex), to, amount);
}

export async function transferShielded(accountIndex: number, to: string, amount: string) {
    this.echo('Performing shielded transfer...');
    this.pause();
    await this.account.transferShielded(chainId(), accountIndex, to, amount);
    this.resume();
    this.echo('Done');
}

export async function depositShielded(accountIndex: string, amount: string) {
    this.echo('Performing shielded deposit...');
    this.pause();
    await this.account.depositShielded(chainId(), parseInt(accountIndex), amount);
    this.resume();
    this.echo('Done');
}

export async function withdrawShielded(accountIndex: string, amount: string) {
    this.echo('Performing shielded withdraw...');
    this.pause();
    await this.account.withdrawShielded(chainId(), parseInt(accountIndex), amount);
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
    const coin = account.hdWallet.getNetwork(chainId())!;
    await coin.updateState();
    const data = coin.zpState.account.getWholeState();
    console.log(data);

    for (const [index, tx] of data.txs) {
        this.echo(`${index}: ${JSON.stringify(tx)}`);
    }
}
