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
  'get-address': [c.getAddress, '<account index>', 'derive a new address for specified index (0 if not specified)'],
  'gen-shielded-address': [c.genShieldedAddress, '', 'generate a new shielded address'],
  'get-private-key': [c.getPrivateKey, '<account index> <password>', 'print the private key'],
  'get-balance': [c.getBalance, '<account index>', 'fetch and print account balance'],
  'get-shielded-balance': [c.getShieldedBalance, '', 'get calculated private balance'],
  'get-balances': [c.getBalances, '', 'print balances for all'],
  'get-token-balance': [c.getTokenBalance, '<account index>', ''],
  'testnet-mint': [c.mint, '<account index> <amount>', ''],
  'transfer': [c.transfer, '<account index> <to> <amount>', 'transfer token, <amount> in base units (e.g.: yoctoNEAR, Wei)'],
  'transfer-shielded': [c.transferShielded, '<account> <to> <amount>', ''],
  'deposit-shielded': [c.depositShielded, '<account> <amount>', ''],
  'withdraw-shielded': [c.withdrawShielded, '<account> <amount>', ''],
  'clear': [c.clear, '', 'clear terminal'],
  'reset': [c.reset, '', 'reset console state'],
  'internal-state': [c.showState, '', 'show internal state'],
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
<h3>
  Welcome to the ZeroPool console for ${NETWORK}.
</h3>

<p>
  Before using any of the listed command make sure you have<br>
  enough balance to pay for gas. You may use the 'transfer' command<br>
  to transfer native coin if needed.
</p>

<p>
  <h4>Usage example:</h4>
  <div class="comment">// Get native balances for first few account for the current seed phrase.</div>
  <div class="command-example">get-balances</div>
  <div class="comment">// Or get balance for an account with a particular index.</div>
  <div class="command-example">get-balance 0</div>
  <div class="comment">// If you don't have any native tokens you have two choices:</div>
  <div class="comment">//   1. Use the current network's faucet to get some.</div>
  <div class="comment">//   2. Transfer from a different account.</div>
  <div class="comment">// If you want to transfer from a different account you'll need to know.</div>
  <div class="comment">// one of the addresses for your current account:</div>
  <div class="command-example">get-address 0</div>
  <div class="comment">// Mint 5 * 10^18 tokens for the account with index 0.</div>
  <div class="command-example">testnet-mint 0 5000000000000000000</div>
  <div class="comment">// Check that the newly minted tokens are there.</div>
  <div class="command-example">get-token-balance 0</div>
  <div class="comment">// Deposit 2 * 10^18 of those tokens to the pool.</div>
  <div class="command-example">deposit-shielded 0 2000000000000000000</div>
  <div class="comment">// Generate a new shielded address.</div>
  <div class="command-example">gen-shielded-address</div>
  <div class="comment">// Transfer 1 * 10^18 of deposited tokens the specified address.</div>
  <div class="command-example">transfer-shielded 0 &ltaddress&gt 1000000000000000000</div>
  <div class="comment">// Withdraw the remaining 2 * 10^18 from the pool.</div>
  <div class="command-example">withdraw-shielded 0 2000000000000000000</div>
  <div class="comment">// If you want to check your shielded balance between '*-shielded' commands:</div>
  <div class="command-example">get-shielded-balance</div>
</p>

<p>
Enter 'help' for more info on available commands.
</p>
`;
      this.echo(message, { raw: true });
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
