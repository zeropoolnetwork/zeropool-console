import Account from './account';
import bip39 from 'bip39-light';

export async function setSeed(account: Account, seed: string, password: string) {
  await account.init(seed, password);
}

export function getSeed(account: Account, password: string) {
  const seed = account.getSeed(password);
  this.echo(`[[;gray;]Seed phrase: ${seed}]`);
}

export function genSeed() {
  const seed = bip39.generateMnemonic();
  this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
}

export async function getAddress(account: Account) {
  const address = await account.getRegularAddress();
  this.echo(`[[;gray;]Address: ${address}]`);
}

export function genShieldedAddress(account: Account) {
  const address = account.genShieldedAddress();
  this.echo(`[[;gray;]${address}]`);
}

export async function getBalance(account: Account) {
  const [balance, readable] = await account.getBalance();
  this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
}

export async function getShieldedBalance(account: Account) {
  this.pause();
  const balance = await account.getShieldedBalance();
  this.echo(balance);
  this.resume();
}

export async function getTokenBalance(account: Account) {
  return account.getTokenBalance();
}

export async function mint(account: Account, amount: string) {
  return account.mint(amount);
}

export async function transfer(account: Account, to: string, amount: string) {
  await account.transfer(to, amount);
}

export async function transferShielded(account: Account, to: string, amount: string) {
  this.echo('Performing shielded transfer...');
  this.pause();
  await account.transferShielded(to, amount);
  this.resume();
}

export async function depositShielded(account: Account, amount: string) {
  this.echo('Performing shielded deposit...');
  this.pause();
  await account.depositShielded(amount);
  this.resume();
}

export async function depositDelegated(account: Account, to: string, amount: string) {
  this.echo('Performing shielded deposit...');
  this.pause();
  await account.depositDelegated(to, amount);
  this.resume();
}

export async function withdrawShielded(account: Account, amount: string) {
  this.echo('Performing shielded withdraw...');
  this.pause();
  await account.withdrawShielded(amount);
  this.resume();
}

export async function getInternalState(account: Account) {
  const state = await account.getInternalState();

  for (const [index, tx] of state.txs) {
    this.echo(`${index}: ${JSON.stringify(tx)}`);
  }
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
