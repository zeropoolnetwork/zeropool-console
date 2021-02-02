import jQuery from 'jquery';
import initTerminal from 'jquery.terminal';
import initAutocomplete from 'jquery.terminal/js/autocomplete_menu';
import bip39 from 'bip39-light';
import { generateMnemonic } from 'zeropool-api-js/lib/utils';
import { CoinType } from 'zeropool-api-js';

import Account, { Env } from './account';

// TODO: Better state management
let account: Account = null;

const PRIVATE_COMMANDS = [
    'set-seed',
    'get-seed',
    'get-private-key',
    'unlock',
];

const ALL_COMMANDS = [
    'set-seed',
    'get-seed',
    'gen-seed',
    'get-address',
    'get-near-address',
    'get-private-key',
    'unlock',
    'transfer',
    'clear',
    'reset',
    'help',
];

jQuery(function ($) {
    initTerminal($);
    initAutocomplete($);

    function help() {
        // TODO: Better help
        const help = `[[;gray;]Available commands:
    set-seed <seedPhrase> <password> - replace the seed phrase for the current account
    get-seed <password> - print the seed phrase for the current account
    gen-seed - generate and print a new seed phrase
    get-address <chainId> - derive and print a new address with specified coin_type
    get-private-key <chainId> <password> - print the private key for the current NEAR account
    get-balance <chainId> - fetch and print account balance
    unlock <password> - unlock the current account if was locked by a timeout
    transfer <chainId> <to> <amount> - transfer <chainId> token
    transfer-private <chainId> <from> <to> <amount> - unimplemented
    clear - clear terminal
    reset - reset console state
    help - print help message]`;
        this.echo(help);
    }

    const commands = {
        'set-seed': async function (seed, password) {
            await account.login(seed, password);
        },
        'get-seed': function (password) {
            const seed = account.getSeed(password);
            this.echo(`[[;gray;]Seed phrase: ${seed}]`);
        },
        'gen-seed': function () {
            const seed = generateMnemonic();
            this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
        },
        'get-address': function (chainId) {
            const address = account.getRegularAddress(chainId);
            this.echo(`[[;gray;]Address: ${address}]`);
        },
        'get-private-key': function (chainId, password) {
            const seed = account.getRegularPrivateKey(chainId, password);
            this.echo(`[[;gray;]Seed phrase: ${seed}]`);
        },
        'get-balance': async function (chainId) {
            const balance = await account.getBalance(chainId);
            this.echo(`[[;gray;]Balance: ${balance}]`);
        },
        'get-balances': async function () {
            const balances = await account.getBalances();
            let buf = '';

            for (const [coinType, balance] of Object.entries(balances)) {
                buf += `    ${CoinType[coinType]}: ${balance}\n`;
            }

            this.echo(`[[;gray;]Balances:\n${buf}]`);
        },
        'transfer': async function (chainId, to, amount) {
            await account.transfer(chainId, to, amount);
        },
        'transfer-private': function () {
            throw new Error('unimplemented');
        },
        'unlock': function (password) {
            account.unlockAccount(password);
        },
        'clear': function () {
            this.clear();
        },
        'reset': function () {
            account = null;
            this.reset();
        },
        help,
    };

    const options = {
        greetings: '[[;green;]ZeroPool interactive CLI]',
        checkArity: false,
        processArguments: false,
        wordAutocomplete: false,
        completion: ALL_COMMANDS,
        historyFilter: function (command) {
            return PRIVATE_COMMANDS.indexOf(command) == -1;
        },
        onInit: async function () {
            const list = Object.values(Env).join(', ');

            // Environment prompt
            let env = await this.read(`Choose environment (${list}): `);

            // Account prompt
            do {
                try {
                    const accountName = await this.read('Enter account name (new or existing): ');

                    if (accountName.trim().length == 0) {
                        throw new Error('Account name cannot be empty');
                    }

                    account = new Account(accountName, env);

                    if (account.isAccountPresent()) {
                        const password = await this.read('Enter password: ');
                        account.unlockAccount(password);
                    } else {
                        let seed = await this.read(`Enter seed phrase or leave empty to generate a new one: `);

                        if (seed.trim().length == 0) {
                            seed = bip39.generateMnemonic();
                            this.echo(`[[;gray;]New mnemonic: ${seed}]`);
                        }

                        const password = (await this.read('Enter new password: ')).trim();

                        // TODO: Proper complexity check
                        if (password.length < 4) {
                            throw new Error('Password is too weak');
                        }

                        await account.login(seed, password);
                    }
                } catch (e) {
                    this.error(e);
                }
            } while (account.isLocked());

            help.apply(this);
        },
        prompt: function () {
            if (account) {
                return `${account.accountName}>`;
            } else {
                return '>';
            }
        },
    };

    $('#terminal').terminal(commands, options);
});
