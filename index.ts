import jQuery from 'jquery';
import initTerminal from 'jquery.terminal';
import { NearClient } from './near';
import { Environment } from './near-config';

// TODO: Better state management
let client: NearClient = null;

jQuery(function ($) {
  initTerminal($);

  function help() {
    // TODO: Better help
    const help = `Available commands:
      login <accountId> [privateKey]
      transfer <receiverId> <amount>
      reset
      help`;
    this.echo(help);
  }

  const commands = {
    login: async function (accountId, privateKey) {
      if (!accountId) {
        this.error('Account ID must be specified');
        return;
      }

      await client.login(accountId, privateKey);

      this.echo(`[[;green;]Connected]`);
    },
    transfer: async function (receiverId, amount) {
      const result = await client.transfer(receiverId, amount);
      this.echo(`${JSON.stringify(result)}`);
    },
    reset: function () {
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
