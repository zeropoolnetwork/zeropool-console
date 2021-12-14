import jQuery from 'jquery';
//@ts-ignore
import initTerminal from 'jquery.terminal';
import initAutocomplete from 'jquery.terminal/js/autocomplete_menu';
import bip39 from 'bip39-light';

import Account from './account';
import * as c from './commands';

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
  'get-address': [c.getAddress, '[account index]', 'derive a new address for specified index (0 if not specified)'],
  'gen-private-address': [c.genPrivateAddress, '', 'generate a new private address'],
  'get-private-key': [c.getPrivateKey, '<account index> <password>', 'print the private key'],
  'get-balance': [c.getBalance, '[account index]', 'fetch and print account balance'],
  'get-private-balance': [c.getPrivateBalance, '', 'get calculated private balance'],
  'get-balances': [c.getBalances, '', 'print balances for all'],
  'get-token-balance': [c.getTokenBalance, '<account index>', ''],
  'mint': [c.mint, '<account index> <amount>', ''],
  'transfer': [c.transfer, '<account index> <to> <amount>', 'transfer token, <amount> in base units (e.g.: yoctoNEAR, Wei)'],
  'transfer-private': [c.transferPrivate, '<account> <to> <amount>', ''],
  'deposit-private': [c.depositPrivate, '<account> <amount>', ''],
  'withdraw-private': [c.withdrawPrivate, '<account> <amount>', ''],
  'clear': [c.clear, '', 'clear terminal'],
  'reset': [c.reset, '', 'reset console state'],
  'private-state': [c.showState, '', 'show internal state'],
  'help': [
    function () {
      let message = '\nAvailable commands:\n' + Object.entries(COMMANDS)
        .map(([name, values]) => {
          const [fn, args, desc] = values;
          console.log(fn.toString());

          let line = `    ${name}`;

          if (args && args.length > 0) {
            line += ` ${args}`;
          }

          if (desc && desc.length > 0) {
            line += ` - [[;gray;]${desc}]`;
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
Welcome to the ZeroPool console for ${NETWORK}.

Before using any of the listed command make sure you have
enough balance to pay for gas. You may use the 'transfer' command
to transfer native coin if needed.

Usage example:
  // Mint 5 * 10^18 tokens.
  mint 0 5000000000000000000
  // Check that the newly minted tokens are there.
  get-token-balance 0
  // Deposit 2 * 10^18 of those tokens to the pool.
  deposit-private 0 2000000000000000000
  // Generate a private address.
  gen-private-address
  // Transfer 1 * 10^18 of deposited tokens the specified address.
  transfer-private 0 <address> 1000000000000000000
  // Withdraw the remaining 2 * 10^18 from the pool.
  withdraw-private 0 2000000000000000000

If you want to check your private balance between '*-private' commands:
  get-private-balance

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

jQuery(async function ($) {
  initTerminal($);
  initAutocomplete($);

  const commands = {};
  for (const [name, values] of Object.entries(COMMANDS)) {
    commands[name] = values[0];
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
      // Account prompt
      do {
        try {
          const accountName = await this.read('Enter account name (new or existing): ');

          if (accountName.trim().length == 0) {
            throw new Error('Account name cannot be empty');
          }

          this.pause();
          this.account = new Account(accountName);
          await this.account.init();
          this.resume();

          if (this.account.isAccountPresent()) {
            this.set_mask(true);
            const password = await this.read('Enter password: ');
            this.set_mask(false);
            this.pause();
            await this.account.unlockAccount(password, () => {
              this.echo('Loading data files...');
            });
            this.resume();
          } else {
            let seed = await this.read(`Enter seed phrase or leave empty to generate a new one: `);

            if (seed.trim().length == 0) {
              seed = bip39.generateMnemonic();
              this.echo(`New mnemonic: ${seed}`);
            } else if (!bip39.validateMnemonic(seed)) {
              throw new Error('Invalid seed phrase');
            }

            this.set_mask(true);
            const password = (await this.read('Enter new password: ')).trim();
            this.set_mask(false);

            // TODO: Proper complexity check
            if (password.length < 4) {
              throw new Error('Password is too weak');
            }

            this.pause();
            await this.account.login(seed, password, () => {
              this.echo('Loading data files...');
            });
            this.resume();
          }
        } catch (e) {
          this.error(e);
        }
      } while (!this.account || !this.account.hdWallet);

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
