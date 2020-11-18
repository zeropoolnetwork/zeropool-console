
import { parseSeedPhrase, encodeKeys as encodeKeys } from './utils';
import AES from 'crypto-js/aes';
import bcrypt from 'bcryptjs';

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface PrivateCache {
    seed: string;
    secretKey: string;
    publicKey: string;
}

export default class LocalAccount {
    private cache?: PrivateCache;
    private lockTimeout?: ReturnType<typeof setTimeout>;
    readonly accountId: string;

    constructor(accountId: string) {
        this.accountId = accountId;
    }

    public async setSeed(seed: string, password: string) {
        const keyPair = parseSeedPhrase(seed);
        const { secretKey, publicKey } = encodeKeys(keyPair)

        this.cache = {
            seed,
            secretKey,
            publicKey,
        };

        const cacheJson = JSON.stringify(this.cache);

        localStorage.setItem(`zconsole.${this.accountId}.cache`, await AES.encrypt(cacheJson, password));
        localStorage.setItem(`zconcole.${this.accountId}.pwHash`, await bcrypt.hash(password, await bcrypt.genSalt(10)));

        this.setAccountTimeout(LOCK_TIMEOUT);
    }

    public isAccountPresent(): boolean {
        return !!localStorage.getItem(`zconsole.${this.accountId}.pwHash`);
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
        const hash = localStorage.getItem('zconcole.pwHash');

        if (!bcrypt.compare(hash, password)) {
            throw new Error('Incorrect password');
        }
    }

    public getRegularAddress(chainId: string): string {
        this.requireAuth();

        const path = `m/44'/${chainId}'/0'/0'/0'`;
        const pair = parseSeedPhrase(this.cache.seed, path);
        const address = Buffer.from(pair.publicKey).toString('hex');

        return address;
    }

    public exportRegularPrivateKey(chainId: string, password: string): string {
        this.unlockAccount(password);

        const path = `m/44'/${chainId}'/0'/0'/0'`;
        const pair = parseSeedPhrase(this.cache.seed, path);
        const { secretKey } = encodeKeys(pair);

        return secretKey;
    }

    public isLocked(): boolean {
        return !this.cache;
    }

    public requireAuth() {
        if (this.isLocked()) {
            throw Error('Unlock the account first');
        }
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
        const cipherText = localStorage.get('zconsole.cache');
        const data = AES.decrypt(cipherText, password);

        return JSON.parse(data);
    }
}
