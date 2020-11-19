// Based on https://github.com/near/near-seed-phrase/blob/master/index.js

import { SignKeyPair, sign, secretbox } from 'tweetnacl';
import { derivePath } from 'near-hd-key';
import bip39 from 'bip39-light';
import bs58 from 'bs58';

const KEY_DERIVATION_PATH = "m/44'/397'/0'"

export interface FormattedKeyPair {
    publicKey: string,
    secretKey: string,
}

export function parseSeedPhrase(phrase: string, path?: string): SignKeyPair {
    const words = phrase
        .trim()
        .split(/\s+/)
        .map(part => part.toLowerCase());

    const fullMnemonic = words.join(' ');

    // validate mnemonic
    bip39.mnemonicToEntropy(fullMnemonic);

    const seed = bip39.mnemonicToSeed(fullMnemonic);
    const { key } = derivePath(path || KEY_DERIVATION_PATH, seed.toString('hex'));
    const keyPair = sign.keyPair.fromSeed(key);

    return keyPair;
}

export function encodeKeys(pair: SignKeyPair): FormattedKeyPair {
    const publicKey = 'ed25519:' + bs58.encode(Buffer.from(pair.publicKey));
    const secretKey = 'ed25519:' + bs58.encode(Buffer.from(pair.secretKey));
    return { secretKey, publicKey };
}
