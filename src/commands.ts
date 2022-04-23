import Account from './account';
import bip39 from 'bip39-light';
import { HistoryRecord, HistoryTransactionType } from 'zeropool-client-js';
import { NetworkType } from 'zeropool-client-js/lib/network-type';
import { deriveSpendingKey, bufToHex } from 'zeropool-client-js/lib/utils';

export async function setSeed(seed: string, password: string) {
    await this.account.login(seed, password);
}

export function getSeed(password: string) {
    const seed = this.account.getSeed(password);
    this.echo(`[[;gray;]Seed phrase: ${seed}]`);
}

export function genSeed() {
    const seed = bip39.generateMnemonic();
    this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
}

export function getSk(password: string) {
    const seed = this.account.getSeed(password);
    const networkType = NETWORK as NetworkType;
    const sk = deriveSpendingKey(seed, networkType);
    this.echo(`[[;gray;]Spending key: 0x${bufToHex(sk)}]`);
}

export async function getAddress() {
    const address = await this.account.getRegularAddress();
    this.echo(`[[;gray;]Address: ${address}]`);
}

export function genShieldedAddress() {
    const address = this.account.genShieldedAddress();
    this.echo(`[[;gray;]${address}]`);
}

export async function getBalance() {
    const [balance, readable] = await this.account.getBalance();
    this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
}

export async function getShieldedBalance() {
    this.pause();
    const [total, acc, note] = await this.account.getShieldedBalances();
    this.echo(`[[;gray;]
Private balance:
    total: ${total} (account + note)
    account: ${acc}
    note: ${note}
]`);
    this.resume();
}

export async function getTokenBalance() {
    return this.account.getTokenBalance();
}

export async function mint(amount: string) {
    return this.account.mint(amount);
}

export async function transfer(to: string, amount: string) {
    await this.account.transfer(to, amount);
}

export async function transferShielded(to: string, amount: string) {
    this.echo('Performing shielded transfer...');
    this.pause();
    const txHash = await this.account.transferShielded(to, amount);
    this.resume();
    this.echo(`Done: [[!;;;;${this.account.getTransactionUrl(txHash)}]${txHash}]`);
}

export async function depositShielded(amount: string) {
    this.echo('Performing shielded deposit...');
    this.pause();
    const txHash = await this.account.depositShielded(amount);
    this.resume();
    this.echo(`Done: [[!;;;;${this.account.getTransactionUrl(txHash)}]${txHash}]`);
}

export async function withdrawShielded(amount: string, address: string) {
    this.echo('Performing shielded withdraw...');
    this.pause();
    const txHash = await this.account.withdrawShielded(amount, address);
    this.resume();
    this.echo(`Done: [[!;;;;${this.account.getTransactionUrl(txHash)}]${txHash}]`);
}

export async function getInternalState() {
    const state = await this.account.getInternalState();
    
    for (const [index, tx] of state.txs) {
        this.echo(`${index}: ${JSON.stringify(tx)}`);
    }
}

export async function printHistory() {
    this.pause();
    const history: HistoryRecord[] = await this.account.getAllHistory();
    this.resume();
    for (const tx of history) {
        this.echo(`${humanReadable(tx, 1000000000, "TOKEN")} [[!;;;;${this.account.getTransactionUrl(tx.txHash)}]${tx.txHash}]`);
    }
}

function humanReadable(record: HistoryRecord, denominator: number, tokenname: string): string {
    let dt = new Date(record.timestamp * 1000);

    let mainPart: string;
    if (record.type == HistoryTransactionType.Deposit) {
      mainPart = `DEPOSITED  ${Number(record.amount) / denominator} ${tokenname} FROM ${record.from}`;      
    } else if (record.type == HistoryTransactionType.TransferIn) {
      mainPart = `RECEIVED   ${Number(record.amount) / denominator} sh${tokenname} ON ${record.to}`;
    } else if (record.type == HistoryTransactionType.TransferOut) {
      mainPart = `SENDED     ${Number(record.amount) / denominator} sh${tokenname} TO ${record.to}`;
    } else if (record.type == HistoryTransactionType.Withdrawal) {
      mainPart = `WITHDRAWED ${Number(record.amount) / denominator} sh${tokenname} TO ${record.to}`;
    } else if (record.type == HistoryTransactionType.TransferLoopback) {
      mainPart = `SENDED     ${Number(record.amount) / denominator} sh${tokenname} TO MYSELF`;
    } else {
      mainPart = `UNKNOWN TRANSACTION TYPE (${record.type})`
    }

    if (record.fee > 0) {
      mainPart += `(fee = ${record.fee})`;
    }

    return `${dt.toLocaleString()} : ${mainPart}`;
}

export function clear() {
    this.clear();
}

export function reset() {
    this.account = null;
    this.reset();
}

// export async function showState() {
//     const account: Account = this.account;
//     const coin = account.hdWallet.getNetwork(chainId())!;
//     await coin.updateState();
//     const data = coin.zpState.account.getWholeState();
//     console.log(data);

//     for (const [index, tx] of data.txs) {
//         this.echo(`${index}: ${JSON.stringify(tx)}`);
//     }
// }
