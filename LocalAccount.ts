import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import bcrypt from 'bcryptjs';
import { Action, createTransaction, signTransaction } from 'near-api-js/lib/transaction';

import { parseSeedPhrase, encodeKeys as encodeKeys } from './utils';

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface PrivateCache {
    seed: string;
    secretKey: string;
    publicKey: string;
}

interface AccountStorage {
    get(accountName: string, field: string): string;
    set(accountName: string, field: string, value: string);
}

class LocalAccountStorage implements AccountStorage {
    get(accountName: string, field: string): string {
        return localStorage.getItem(`zconsole.${accountName}.${field}`);
    }
    set(accountName: string, field: string, value: string) {
        localStorage.setItem(`zconsole.${accountName}.${field}`, value);
    }
}

// TODO: Extract timeout management code
export default class LocalAccount {
    private cache?: PrivateCache;
    private lockTimeout?: ReturnType<typeof setTimeout>;
    readonly accountName: string;
    private storage: AccountStorage;

    constructor(accountName: string) {
        this.accountName = accountName;
        this.storage = new LocalAccountStorage();
    }

    public async login(seed: string, password: string) {
        const keyPair = parseSeedPhrase(seed);
        const { secretKey, publicKey } = encodeKeys(keyPair)

        this.cache = {
            seed,
            secretKey,
            publicKey,
        };

        const cacheJson = JSON.stringify(this.cache);

        this.storage.set(this.accountName, 'cache', await AES.encrypt(cacheJson, password).toString());
        this.storage.set(this.accountName, 'pwHash', await bcrypt.hash(password, await bcrypt.genSalt(10)));

        this.setAccountTimeout(LOCK_TIMEOUT);
    }

    public isAccountPresent(): boolean {
        return !!this.storage.get(this.accountName, 'pwHash');
    }

    public getSeed(password: string): string {
        this.checkPassword(password);

        const cache = this.decryptCache(password);
        return cache.seed;
    }

    public unlockAccount(password: string) {
        this.checkPassword(password);

        this.cache = this.decryptCache(password);
    }

    public checkPassword(password: String) {
        const hash = this.storage.get(this.accountName, 'pwHash');

        if (!bcrypt.compare(hash, password)) {
            throw new Error('Incorrect password');
        }

        this.setAccountTimeout(LOCK_TIMEOUT);
    }

    public getRegularAddress(chainId: string): string {
        this.requireAuth();

        const path = `m/44'/${chainId}'/0'`;
        const pair = parseSeedPhrase(this.cache.seed, path);

        // TODO: Ability to specify encoding?
        const address = Buffer.from(pair.publicKey).toString('hex');

        return address;
    }

    public exportRegularPrivateKey(chainId: string, password: string): string {
        this.unlockAccount(password);

        const path = `m/44'/${chainId}'/0'`;
        const pair = parseSeedPhrase(this.cache.seed, path);
        const { secretKey } = encodeKeys(pair);

        return secretKey;
    }

    public getNearPrivateKey(): string {
        this.requireAuth();
        return this.cache.secretKey;
    }

    public getNearAddress(): string {
        this.requireAuth();
        return this.getRegularAddress('397');
    }

    public isLocked(): boolean {
        return !this.cache;
    }

    public requireAuth() {
        if (this.isLocked()) {
            throw Error('Account is locked. Unlock the account first');
        }

        this.setAccountTimeout(LOCK_TIMEOUT);
    }

    private setAccountTimeout(ms: number) {
        if (this.lockTimeout) {
            clearTimeout(this.lockTimeout);
        }

        this.lockTimeout = setTimeout(function () {
            this.cache = null;
        }, ms);
    }

    private decryptCache(password: string): PrivateCache {
        const cipherText = this.storage.get(this.accountName, 'cache');
        const data = AES.decrypt(cipherText, password).toString(Utf8);

        return JSON.parse(data);
    }
}
