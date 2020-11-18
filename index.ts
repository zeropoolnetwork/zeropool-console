import jQuery from 'jquery';
import initTerminal from 'jquery.terminal';
import NearClient from './NearClient';
import LocalAccount from './LocalAccount';
import { Environment } from './near-config';

// TODO: Better state management
let client: NearClient = null;

const PRIVATE_COMMANDS = [
    'login'
];

jQuery(function ($) {
    initTerminal($);

    function help() {
        // TODO: Better help
        const help = `
Available commands:
    set-seed <seedPhrase> <password>
    get-seed <password>
    get-address
    get-private-key <password>
    unlock <password>
    transfer <fromAddr> <toAddr> <assetId> <amount>
    get-balance
    reset - reset console state
    help - print this message`;
        this.echo(help);
    }

    const commands = {
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
        historyFilter: function (command) {
            return PRIVATE_COMMANDS.indexOf(command) != -1;
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
                    const accountId = await this.read('Enter account name (new or existing): ');
                    const localAccount = new LocalAccount(accountId);

                    if (localAccount.isAccountPresent()) {
                        const password = await this.read('Enter password: ');

                        localAccount.unlockAccount(password);
                    } else {
                        const seed = await this.read(`Enter seed phrase for account '${accountId}': `);
                        const password = await this.read('Enter password: ');

                        await localAccount.setSeed(seed, password);
                    }

                    // TODO: Use setter?
                    client.localAccount = localAccount;
                } catch (e) {
                    this.error(e);
                }
            } while (!client.isLoggedIn());

            help.apply(this);
        },
        prompt: function () {
            if (client && client.localAccount) {
                return `${client.localAccount.accountId}>`;
            } else {
                return '>';
            }
        },
    };

    $('#terminal').terminal(commands, options);
});
