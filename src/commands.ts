import Account from './account';
import bip39 from 'bip39-light';

export async function setSeed(seed: string, password: string) {
  await this.account.init(seed, password);
}

export function getSeed(password: string) {
  const seed = this.account.getSeed(password);
  this.echo(`[[;gray;]Seed phrase: ${seed}]`);
}

export function genSeed() {
  const seed = bip39.generateMnemonic();
  this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
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
  this.pause();
  const [balance, readable] = await this.account.getBalance();
  this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
  this.resume();
}

export async function getShieldedBalance() {
  this.pause();
  const balance = await this.account.getShieldedBalance();
  this.echo(`[[;gray;]Shielded balance: ${balance}]`);
  this.resume();
}

export async function getTokenBalance() {
  this.pause();
  const balance = await this.account.getTokenBalance();
  this.echo(`[[;gray;]Token balance: ${balance}]`);
  this.resume();
}

export async function mint(amount: string) {
  this.pause();
  await this.account.mint(amount);
  this.resume();
}

export async function transferNative(to: string, amount: string) {
  this.pause();
  await this.account.transferNative(to, amount);
  this.resume();
}

export async function transferToken(to: string, amount: string) {
  this.pause();
  await this.account.transferToken(to, amount);
  this.resume();
}

export async function transferShielded(to: string, amount: string) {
  this.echo('Performing shielded transfer...');
  this.pause();
  await this.account.transferShielded(to, amount);
  this.resume();
}

export async function depositShielded(amount: string) {
  this.echo('Performing shielded deposit...');
  this.pause();
  await this.account.depositShielded(amount);
  this.resume();
}

export async function withdrawShielded(amount: string) {
  this.echo('Performing shielded withdraw...');
  this.pause();
  await this.account.withdrawShielded(amount);
  this.resume();
}

export async function getInternalState() {
  const state = await this.account.getInternalState();

  for (const [index, tx] of state.txs) {
    this.echo(`${index}: ${JSON.stringify(tx)}`);
  }
}

export function clear() {
  this.clear();
}

export function resetConsole() {
  this.account.free();
  this.account = null;
  this.reset();
}

export async function resetState() {
  const dbs = await window.indexedDB.databases();
  for (const db of dbs) {
    if (db.name === 'zp.file_cache') continue;
    window.indexedDB.deleteDatabase(db.name)
  }

  this.account = null;
  location.reload();
}
