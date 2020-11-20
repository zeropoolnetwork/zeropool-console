# ZeroPool Web Console

## Build
Run `yarn build` to build the project.
Run `yarn dev` to start the development environment.

## Console commands
After filling out the initial promts the following commands become available:
- `set-seed <seedPhrase> <password>` - replace the seed phrase for the current account
- `get-seed <password>` - print the seed phrase for the current account
- `gen-seed` - generate and print a new seed phrase
- `get-address <chainId>` - derive and print a new address with specified coin_type
- `get-near-address` - print an address for the current NEAR account
- `get-private-key <password>` - print the private key for the current NEAR account
- `get-near-balance` - fetch and print account balance
- `unlock <password>` - unlock the current account if was locked by a timeout
- `transfer-near <toAddr> <amount>` - transfer near tokens,
- `transfer <fromAddr> <toAddr> <assetId> <amount>` - unimplemented
- `clear` - clear terminal
- `reset` - reset console state
- `help` - print help message
