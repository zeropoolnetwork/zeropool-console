import jQuery from 'jquery';
import initTerminal from 'jquery.terminal';
import initAutocomplete from 'jquery.terminal/js/autocomplete_menu';
import NearClient from './near-client';
import LocalAccount from './local-account';
import { Environment } from './near-config';
import bip39 from 'bip39-light';
import { formatNearAmount } from 'near-api-js/lib/utils/format';

// TODO: Better state management
let client: NearClient = null;

const PRIVATE_COMMANDS = [
    'set-seed',
    'get-seed',
    'get-private-key',
    'unlock',
];

const ALL_COMMANDS = [
    'set-seed',
    'get-seed',
    'get-address',
    'get-near-address',
    'get-private-key',
    'unlock',
    'transfer-near',
    'transfer',
    'get-near-balance',
    'clear',
    'reset',
    'help',
];

jQuery(function ($) {
    initTerminal($);
    initAutocomplete($);

    function help() {
        // TODO: Better help
        const help = `Available commands:
    set-seed <seedPhrase> <password>
    get-seed <password>
    gen-seed
    get-address <chainId>
    get-near-address
    get-private-key <password>
    get-near-balance
    unlock <password>
    transfer-near <toAddr> <amount>
    transfer <fromAddr> <toAddr> <assetId> <amount> - unimplemented
    clear
    reset - reset console state
    help - print this message`;
        this.echo(help);
    }

    const commands = {
        'set-seed': async function (seed, password) {
            await client.localAccount.login(seed, password);
            await client.login(client.localAccount);
        },
        'get-seed': function (password) {
            const seed = client.localAccount.getSeed(password);
            this.echo(`[[;gray;]Seed phrase: ${seed}]`);
        },
        'gen-seed': function () {
            const seed = bip39.generateMnemonic();
            this.echo(`[[;gray;]Generated mnemonic: ${seed}]`);
        },
        'get-address': function (chainId) {
            const address = client.localAccount.getRegularAddress(chainId);
            this.echo(`[[;gray;]Address: ${address}]`);
        },
        'get-near-address': function () {
            const address = client.localAccount.getNearAddress();
            this.echo(`[[;gray;]NEAR address: ${address}]`);
        },
        'get-near-balance': async function (accountId) {
            const balance = await client.getNearBalance(accountId);

            const formatted = `[[;gray;]Balance for ${accountId || client.localAccount.getNearAddress()}
    Total:        ${formatNearAmount(balance.total)} (${balance.total})
    State staked: ${formatNearAmount(balance.stateStaked)} (${balance.stateStaked})
    Staked:       ${formatNearAmount(balance.staked)} (${balance.staked})
    Available:    ${formatNearAmount(balance.available)} (${balance.available})]`;

            this.echo(formatted);
        },
        'transfer-near': async function (to, amount) {
            await client.transferNear(to, amount);
        },
        'transfer': function () {
            throw new Error('unimplemented');
        },
        'unlock': function (password) {
            client.localAccount.unlockAccount(password);
        },
        'clear': function () {
            this.clear();
        },
        'reset': function () {
            client = null;
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
            const list = Object.values(Environment).join(', ');

            // Environment prompt
            do {
                try {
                    const env = await this.read(`Choose environment (${list}): `);
                    client = new NearClient(env);
                    this.echo(`[[;gray;]Config: ${JSON.stringify(client.config)}\n]`);
                } catch (e) {
                    this.error(e);
                }
            } while (!client);

            // Account prompt
            do {
                try {
                    const accountName = await this.read('Enter account name (new or existing): ');

                    if (accountName.trim().length == 0) {
                        throw new Error('Account name cannot be empty');
                    }

                    const localAccount = new LocalAccount(accountName);

                    if (localAccount.isAccountPresent()) {
                        const password = await this.read('Enter password: ');
                        localAccount.unlockAccount(password);
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

                        await localAccount.login(seed, password);
                    }

                    await client.login(localAccount);
                } catch (e) {
                    this.error(e);
                }
            } while (!client.isLoggedIn());

            help.apply(this);
        },
        prompt: function () {
            if (client && client.localAccount) {
                return `${client.localAccount.accountName}>`;
            } else {
                return '>';
            }
        },
    };

    $('#terminal').terminal(commands, options);
});
