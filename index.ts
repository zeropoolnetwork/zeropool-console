import jQuery from 'jquery';
import initTerminal from 'jquery.terminal';
import { NearClient } from './near';
import { Environment } from './near-config';

// TODO: Better state management
let client: NearClient = null;

// TODO: Address methods
// TODO: zeropool transfer

jQuery(function ($) {
  initTerminal($);

  function help() {
    // TODO: Better help
    const help = `Available commands:
      login <accountId> [privateKey] - privateKey is optional if you've logged in earlier
      login-mnemonic <accountId> [mnemonic] [password] - mnemonic is optional if you've logged in earlier
      transfer <receiverId> <amount> - transfer by account ID.
      transfer-addr <fromAddr> <toAddr> <assetId> <amount> - unimplemented
      reset
      help`;
    this.echo(help);
  }

  const commands = {
    'login': async function (accountId, privateKey) {
      if (!accountId) {
        throw new Error('Account ID must be specified');
      }

      await client.login(accountId, privateKey);

      this.echo(`[[;green;]Connected]`);
    },
    'login-mnemonic': async function (accountId, mnemonic, password) {
      if (!accountId) {
        throw new Error('Account ID must be specified');
      }

      // TODO: Mnemonic validation
      const words = mnemonic.split(' ');
      await client.loginWithMnemonic(accountId, words, password);

      this.echo(`[[;green;]Connected]`);
    },
    'transfer': async function (receiverId, amount) {
      const result = await client.transfer(receiverId, amount);
      this.echo(`${JSON.stringify(result)}`);
    },
    'transfer-addr': async function (fromAddr, toAddr, assetId, amount) {

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
    processArguments: function (args) {
      return args.split(' ');
    },
    onInit: async function () {
      const list = Object.values(Environment).join(', ');

      do {
        try {
          const env = await this.read(`Choose environment (${list}): `);
          client = new NearClient(env);
          this.echo(`[[;gray;]Config: ${JSON.stringify(client.config)}\n]`);
          help.apply(this);
        } catch (e) {
          this.error(e);
        }
      } while (!client);
    },
    prompt: function () {
      if (client && client.account) {
        return `${client.account.accountId}>`;
      } else {
        return '>';
      }
    },
  };

  $('#terminal').terminal(commands, options);
});
