import jQuery from 'jquery';
import initTerminal from 'jquery.terminal';
import initAutocomplete from 'jquery.terminal/js/autocomplete_menu';
import bip39 from 'bip39-light';

import Account, { Env } from './account';
import * as c from './commands';

// TODO: Better state management
let account: Account;

const PRIVATE_COMMANDS = [
  'set-seed',
  'get-seed',
  'get-private-key',
  'unlock',
];

const COMMANDS: { [key: string]: [(...args) => void, string, string] } = {
  'set-seed': [c.setSeed, '<seed phrase> <password>', 'replace the seed phrase for the current account'],
  'get-seed': [c.getSeed, '<password>', 'print the seed phrase for the current account'],
  'gen-seed': [c.genSeed, '', 'generate and print a new seed phrase'],
  'get-address': [c.getAddress, '<coin type> [account index]', 'derive a new address with specified coin type'],
  'gen-private-address': [c.genPrivateAddress, '<coin type>', 'generate a new private address'],
  'get-private-key': [c.getPrivateKey, '<coin type> <account index> <password>', 'print the private key'],
  'get-balance': [c.getBalance, '<coin type> [account index]', 'fetch and print account balance'],
  'get-private-balance': [c.getPrivateBalance, '<coin type>', 'get calculated private balance'],
  'get-balances': [c.getBalances, '<account index>', 'print balances for all'],
  'mint': [c.mint, '<coin type> <account index> <amount>', ''],
  'get-token-balance': [c.getTokenBalance, '<coin type> <account index>', ''],
  // 'unlock': [c.unlock, ''],
  'transfer': [c.transfer, '<coin type> <account index> <to> <amount>', 'transfer <coin type> token, <amount> in base units (e.g.: yoctoNEAR, Wei)]'],
  'transfer-private': [c.transferPrivate, '<coin type> <account> <to> <amount>', ''],
  'deposit-private': [c.depositPrivate, '<coin type> <account> <amount>', ''],
  'withdraw-private': [c.withdrawPrivate, '<coin type> <account> <amount>', ''],
  'clear': [c.clear, '', 'clear terminal'],
  'reset': [c.reset, '', 'reset console state'],
  'private-state': [c.showState, '', 'show internal state'],
  'help': [
    function () {
      let message = '\nAvailable commands:\n' + Object.entries(COMMANDS)
        .map(pair => {
          let line = `    ${pair[0]}`;

          if (pair[1][1] && pair[1][1].length > 0) {
            line += ` ${pair[1][1]}`;
          }

          if (pair[1][2] && pair[1][2].length > 0) {
            line += ` - [[;gray;]${pair[1][2]}]`;
          }

          return line;
        })
        .join('\n');
      message += '\n';
      this.echo(message);
    },
    '',
    'print help message'
  ],
  'intro': [
    function () {
      const message = String.raw`
TODO: Help
Enter 'help' for more info on available commands.
`;
      this.echo(message);
    },
    '',
    'print introduction message'
  ]
};


const GREETING = String.raw`
 _____              ____             _
|__  /___ _ __ ___ |  _ \ ___   ___ | |
  / // _ \ '__/ _ \| |_) / _ \ / _ \| |
 / /|  __/ | | (_) |  __/ (_) | (_) | |
/____\___|_|  \___/|_|   \___/ \___/|_|
`;

function greeting(term) {
  term.echo(GREETING, { raw: true });
}

jQuery(async function ($) {
  initTerminal($);
  initAutocomplete($);

  const commands = {};

  for (const pair of Object.entries(COMMANDS)) {
    commands[pair[0]] = pair[1][0];
  }

  const options = {
    greetings: GREETING,
    checkArity: false,
    processArguments: false,
    wordAutocomplete: false,
    completion: Object.keys(COMMANDS),
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

          this.account = new Account(accountName, env);
          await this.account.init();

          if (this.account.isAccountPresent()) {
            this.set_mask(true);
            const password = await this.read('Enter password: ');
            this.set_mask(false);
            await this.account.unlockAccount(password);
          } else {
            let seed = await this.read(`Enter seed phrase or leave empty to generate a new one: `);

            // TODO: Proper validation
            if (!bip39.validateMnemonic(seed)) {
              throw new Error('Invalid seed phrase');
            }

            if (seed.trim().length == 0) {
              seed = bip39.generateMnemonic();
              this.echo(`New mnemonic: ${seed}]`);
            }

            const password = (await this.read('Enter new password: ')).trim();

            // TODO: Proper complexity check
            if (password.length < 4) {
              throw new Error('Password is too weak');
            }

            await this.account.login(seed, password);
          }
        } catch (e) {
          this.error(e);
        }
      } while (!this.account || this.account.isLocked());

      this.clear();
      this.echo(GREETING);
      COMMANDS['intro'][0].apply(this);
    },
    prompt: function () {
      if (this.account) {
        return `[[;gray;]${this.account.accountName}>] `;
      } else {
        return '[[;gray;]>] ';
      }
    },
  };

  // jquery.terminal doesn't have proper type definitions for async commands
  // @ts-ignore
  $('#terminal').terminal(commands, options);
});
