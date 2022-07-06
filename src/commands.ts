import Account from './account';
import bip39 from 'bip39-light';
import { HistoryRecord, HistoryTransactionType } from 'zkbob-client-js';
import { NetworkType } from 'zkbob-client-js/lib/network-type';
import { deriveSpendingKey, verifyShieldedAddress, bufToHex } from 'zkbob-client-js/lib/utils';

const DENOMINATOR = 1000000000000000000;

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
    const optimisticBalance = await this.account.getOptimisticTotalBalance();

    this.echo(`[[;gray;]
Private balance:
    total:   ${total / DENOMINATOR} ${SHIELDED_TOKEN_SYMBOL} (${total} wei) (account + note)
    account: ${acc / DENOMINATOR} ${SHIELDED_TOKEN_SYMBOL} (${acc} wei)
    note:    ${note / DENOMINATOR} ${SHIELDED_TOKEN_SYMBOL} (${note} wei)
]`);

    if (total != optimisticBalance) {
        this.echo(`[[;green;]Optimistic private balance: ${optimisticBalance / DENOMINATOR} ${SHIELDED_TOKEN_SYMBOL} (${optimisticBalance} wei)
]`);
    }

    this.resume();
}

export async function getTokenBalance() {
    const balance = await this.account.getTokenBalance();
    this.echo(`[[;gray;]Token balance: ${balance / DENOMINATOR} ${TOKEN_SYMBOL} (${balance} wei)]`);
}

export async function mint(amount: string) {
    return this.account.mint(amount);
}

export async function transfer(to: string, amount: string) {
    await this.account.transfer(to, amount);
}

export async function getTxParts(amount: string, fee: string) {
    this.pause();
    const result = await this.account.getTxParts(amount, fee);
    this.resume();

    for (const part of result) {
        this.echo(`${part.amount.toString()} [fee: ${part.fee.toString()}], limit = ${part.accountLimit.toString()}`);
    }
}

export async function transferShielded(to: string, amount: string) {
    if (verifyShieldedAddress(to) === false) {
        this.error(`Shielded address ${to} is invalid. Please check it!`);
    } else {
        this.echo('Performing shielded transfer...');
        this.pause();
        const txHash = await this.account.transferShielded(to, amount);
        this.resume();
        this.echo(`Done: [[!;;;;${this.account.getTransactionUrl(txHash)}]${txHash}]`);
    };
}

export async function depositShielded(amount: string) {
    this.echo('Performing shielded deposit...');
    this.pause();
    const txHash = await this.account.depositShielded(amount);
    this.resume();
    this.echo(`Done: [[!;;;;${this.account.getTransactionUrl(txHash)}]${txHash}]`);
}

export async function depositShieldedPermittable(amount: string) {
    this.echo('Performing shielded deposit (permittable token)...');
    this.pause();
    const txHash = await this.account.depositShieldedPermittable(amount);
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
    let pendingMark = ``;
    if (record.pending) {
        pendingMark = `⌛ `;
    }
    if (record.type == HistoryTransactionType.Deposit) {
      mainPart = `${pendingMark}DEPOSITED  ${Number(record.amount) / denominator} ${TOKEN_SYMBOL} FROM ${record.from}`;      
    } else if (record.type == HistoryTransactionType.TransferIn) {
      mainPart = `${pendingMark}RECEIVED   ${Number(record.amount) / denominator} ${SHIELDED_TOKEN_SYMBOL} ON ${record.to}`;
    } else if (record.type == HistoryTransactionType.TransferOut) {
      mainPart = `${pendingMark}SENDED     ${Number(record.amount) / denominator} ${SHIELDED_TOKEN_SYMBOL} TO ${record.to}`;
    } else if (record.type == HistoryTransactionType.Withdrawal) {
      mainPart = `${pendingMark}WITHDRAWED ${Number(record.amount) / denominator} ${SHIELDED_TOKEN_SYMBOL} TO ${record.to}`;
    } else if (record.type == HistoryTransactionType.TransferLoopback) {
      mainPart = `${pendingMark}SENDED     ${Number(record.amount) / denominator} ${SHIELDED_TOKEN_SYMBOL} TO MYSELF`;
    } else {
      mainPart = `${pendingMark}UNKNOWN TRANSACTION TYPE (${record.type})`
    }

    if (record.fee > 0) {
      mainPart += `(fee = ${record.fee})`;
    }

    return `${dt.toLocaleString()} : ${mainPart}`;
}

export function cleanState() {
    this.pause();
    this.account.cleanInternalState();
    this.resume();
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
