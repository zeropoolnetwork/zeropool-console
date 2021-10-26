import jQuery from 'jquery';
// @ts-ignore
import initTerminal from 'imports-loader?additionalCode=var%20define=false;!jquery.terminal';
// @ts-ignore
import initAutocomplete from 'imports-loader?additionalCode=var%20define=false;!jquery.terminal/js/autocomplete_menu';
import bip39 from 'bip39-light';
import { generateMnemonic } from 'zeropool-api-js/lib/utils';
import { CoinType } from 'zeropool-api-js';

import './styles.css';

import Account, { Env } from './account';

// TODO: Better state management
let account: Account;

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

const GREETING = '[[;green;]ZeroPool console]';

jQuery(function ($) {
    initTerminal($);
    initAutocomplete($);

    function help() {
        // TODO: Better help
        const help = `Available commands:
    set-seed <seedPhrase> <password> [[;gray;]- replace the seed phrase for the current account]
    get-seed <password> [[;gray;]- print the seed phrase for the current account]
    gen-seed [[;gray;]- generate and print a new seed phrase]
    get-address <coin type> [account index] [[;gray;]- derive a new address with specified coin type]
    gen-private-address <coin type> [[;gray;]- generate a new private address]
    get-private-key <coin type> <account index> <password> [[;gray;]- print the private key for the current NEAR account]
    get-balance <coin type> [account index] [[;gray;]- fetch and print account balance]
    get-private-balance <coin type> [[;gray;]- get calculated private balance]
    get-balances <account index> [[;gray;]- print balances for all]
    unlock <password> [[;gray;]- unlock the current account if was locked by a timeout]
    transfer <coin type> <account index> <to> <amount> [[;gray;]- transfer <coin type> token, <amount> in base units (e.g.: yoctoNEAR, Wei)]
    transfer-private <coin type> <account> <to> <amount>
    deposit-private <coin type> <account> <amount>
    withdraw-private <coin type> <account> <amount>
    make-private-tx <coin type> <to> <amount>
    clear [[;gray;]- clear terminal]
    reset [[;gray;]- reset console state]
    help [[;gray;]- print help message]`;
        this.echo(help);
    }

    const commands = {
        'set-seed': async function (seed: string, password: string) {
            await account.login(seed, password);
        },
        'get-seed': function (password: string) {
            const seed = account.getSeed(password);
            this.echo(`[[;gray;]Seed phrase: ${seed}]`);
        },
        'gen-seed': function () {
            const seed = generateMnemonic();
            this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
        },
        'get-address': function (chainId: string, accountIndex: string = '0') {
            const address = account.getRegularAddress(chainId, parseInt(accountIndex));
            this.echo(`[[;gray;]Address: ${address}]`);
        },
        'gen-private-address': function (chainId: string) {
            const address = account.getPrivateAddress(chainId);
            this.echo(`[[;gray;]${address}]`);
        },
        'get-private-key': async function (chainId: string, accountIndex: string, password: string) {
            const seed = await account.getRegularPrivateKey(chainId, parseInt(accountIndex), password);
            this.echo(`[[;gray;]Private key: ${seed}]`);
        },
        'get-balance': async function (chainId: string, accountIndex: string = '0') {
            const [balance, readable] = await account.getBalance(chainId as CoinType, parseInt(accountIndex));
            this.echo(`[[;gray;]Balance: ${readable} (${balance})]`);
        },
        'get-private-balance': async function (chainId: string) {
            const [total, acc, note] = await account.getPrivateBalances(chainId as CoinType);
            this.echo(`[[;gray;]Private balance: ${total} (${acc} + ${note})]`);
        },
        'get-balances': async function () {
            const balances = await account.getBalances();
            let buf = '';

            for (const [coinType, coinBalances] of Object.entries(balances)) {
                buf += `    ${CoinType[coinType]}:\n`;

                for (const balance of coinBalances) {
                    buf += `        ${balance.address}: ${balance.balance}\n`;
                }
            }

            this.echo(`Balances:\n${buf}`);
        },
        'transfer': async function (chainId: string, accountIndex: string, to: string, amount: string) {
            await account.transfer(chainId, parseInt(accountIndex), to, amount);
        },
        'transfer-private': async function (chainId: string, accountIndex: number, to: string, amount: string) {
            await account.transferPrivate(chainId, accountIndex, to, amount);
        },
        'deposit-private': async function (chainId: string, accountIndex: string, amount: string) {
            this.echo('Performing deposit');
            await account.depositPrivate(chainId, parseInt(accountIndex), amount);
            this.echo('Done');
        },
        'withdraw-private': async function (chainId: string, accountIndex: string, amount: string) {
            await account.withdrawPrivate(chainId, parseInt(accountIndex), amount);
        },
        'make-private-tx': function (chainId: string, to: string, amount: string) {
            let tx = account.makePrivateTx(chainId, to, amount);
            this.echo(tx);
        },
        'unlock': async function (password) {
            await account.unlockAccount(password);
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
        greetings: GREETING,
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
            // let env = await this.read(`Choose environment (${list}): `);

            // if (!list.includes(env)) {
            //     throw new Error(`Unknown environment: ${env}`);
            // }

            let env = 'dev' as Env;

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
                        await account.unlockAccount(password);
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
            } while (!account || account.isLocked());

            this.clear();
            this.echo(GREETING);
            help.apply(this);
        },
        prompt: function () {
            if (account) {
                return `[[;gray;]${account.accountName}>]`;
            } else {
                return '[[;gray;]>]';
            }
        },
    };

    // jquery.terminal doesn't have proper type definitions for async commands
    // @ts-ignore
    $('#terminal').terminal(commands, options);
});
