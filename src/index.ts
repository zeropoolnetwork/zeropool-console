import './styles.css';
import jQuery from 'jquery';
// // @ts-ignore
// import initTerminal from 'imports-loader?additionalCode=var%20define=false;!jquery.terminal';
// // @ts-ignore
// import initAutocomplete from 'imports-loader?additionalCode=var%20define=false;!jquery.terminal/js/autocomplete_menu';
//@ts-ignore
import initTerminal from 'jquery.terminal';
// import initAutocomplete from 'jquery.terminal/js/autocomplete_menu';
import bip39 from 'bip39-light';
//import {Version} from '../package.json';

var pjson = require('../package.json');


import Account from './account';
import * as c from './commands';

const PRIVATE_COMMANDS = [
  'set-seed',
  'get-seed',
  'get-private-key',
];

const COMMANDS: { [key: string]: [(...args) => void, string, string] } = {
  'set-seed': [c.setSeed, '<seed phrase> <password>', 'replace the seed phrase for the current account'],
  'get-seed': [c.getSeed, '<password>', 'print the seed phrase for the current account'],
  'gen-seed': [c.genSeed, '', 'generate and print a new seed phrase'],
  'get-address': [c.getAddress, '', 'derive a new address for specified index (0 if not specified)'],
  'gen-shielded-address': [c.genShieldedAddress, '', 'generate a new shielded address'],
  // 'get-private-key': [c.getPrivateKey, ' <password>', 'print the private key'],
  'get-balance': [c.getBalance, '', 'fetch and print account balance'],
  'get-shielded-balance': [c.getShieldedBalance, '', 'get calculated private balance'],
  // 'get-balances': [c.getBalances, '', 'print balances for all'],
  'get-token-balance': [c.getTokenBalance, '', ''],
  'testnet-mint': [c.mint, ' <amount>', ''],
  'transfer-native': [c.transferNative, ' <to> <amount>', 'transfer native token publicly'],
  'transfer-token': [c.transferToken, ' <to> <amount>', 'transfer current token publicly (can be the same as native token, depenging on configuration)'],
  'transfer-shielded': [c.transferShielded, '<account> <shielded address> <amount>', ''],
  'deposit-shielded': [c.depositShielded, '<account> <amount>', ''],
  'withdraw-shielded': [c.withdrawShielded, '<account> <amount>', ''],
  'internal-state': [c.getInternalState, '', ''],
  'clear': [c.clear, '', 'clear terminal'],
  'reset-state': [c.resetState, '', 'clear indexedDB state'],
  'reset': [c.resetConsole, '', 'reset console'],
  'version': [
    function () {
      this.echo(`ZeroPool console version ${pjson.version}`);
    },
    '',
    'get console version'
  ],
  'environment': [
    function () {
      this.echo(`Network: ${NETWORK}`);
      this.echo(`RPC URL: ${RPC_URL}`);
      this.echo(`Relayer: ${RELAYER_URL}`);
      this.echo(`Pool:    ${CONTRACT_ADDRESS}`);
      this.echo(`Token:   ${TOKEN_ADDRESS}`);
    },
    '',
    'get environment constants'
  ],
  // 'internal-state': [c.showState, '', 'show internal state'],
  'help': [
    function () {
      let message = '\nAvailable commands:\n' + Object.entries(COMMANDS)
        .map(([name, values]) => {
          const [fn, args, desc] = values;
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
  <div class="comment">// Check your balance.</div>
  <div class="command-example">get-balance</div>
  <div class="comment">// If you don't have any native tokens you have two choices:</div>
  <div class="comment">//   1. Use the current network's faucet to get some.</div>
  <div class="comment">//   2. Transfer from a different account.</div>
  <div class="comment">// Get the address of the current account:</div>
  <div class="command-example">get-address</div>
  <div class="comment">// Mint 5 tokens:</div>
  <div class="command-example">testnet-mint 5</div>
  <div class="comment">// Deposit 2 of those tokens to the pool:</div>
  <div class="command-example">deposit-shielded 2</div>
  <div class="comment">// Generate a new shielded address:</div>
  <div class="command-example">gen-shielded-address</div>
  <div class="comment">// Transfer 1 of deposited tokens the specified address:</div>
  <div class="command-example">transfer-shielded "shielded address here" 1</div>
  <div class="comment">// Withdraw the remaining 2 from the pool:</div>
  <div class="command-example">withdraw-shielded 2</div>
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
                                 v${pjson.version}
    `;

jQuery(async function ($) {
  initTerminal($);
  // initAutocomplete($);

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
    exceptionHandler: function (err) {
      this.resume();
      this.exception(err);
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
          this.resume();

          if (this.account.isAccountPresent()) {
            this.set_mask(true);
            const password = await this.read('Enter password: ');
            this.set_mask(false);
            this.pause();
            this.echo('Loading data files...');
            await this.account.unlockAccount(password);
            this.resume();
          } else {
            let address = undefined;
            if (NETWORK == 'near') {
              const account = await this.read('Enter account ID (optional): ');
              if (account.trim().length !== 0) {
                address = account;
              }
            }

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
            await this.account.init(seed, password, address);
            this.resume();
          }
        } catch (e) {
          this.resume();
          this.error(e);
          console.error(e);
        }
      } while (!this.account || !this.account.isInitialized());

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
