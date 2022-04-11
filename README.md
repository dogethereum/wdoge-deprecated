# Doge token contract

The Dogecoin-Ethereum bridge requires a token to represent doges in the Ethereum network. This repository contains a token contract that fulfills this goal.

## Prerequisites

- [nodejs](https://nodejs.org) [latest LTS](https://nodejs.org/en/about/releases/) or above. This is currently fermium (v14).

Additionally, several snippets assume you have installed the [Hardhat shorthand](https://hardhat.org/guides/shorthand.html). These can be replaced with a Hardhat invocation through `npx` like so:

```sh
npx hardhat
```

## Installing

To run tests or deployment you need to install the root package dependencies. To do so:

- `cd` to the directory where the repo is cloned.
- Execute `npm install`.

## Running the Tests

There are unit tests for the token contract.

Use `npm test` to run them.

## Usage

### Viewing your balance in MetaMask

1. Select your account.
2. Go to `Assets` tab.
3. Click `Import tokens`.
4. Paste the token contract address. The contract should have the `TransparentUpgradeableProxy` contract name.
5. Wait for the Token Symbol and Token Decimals to be auto detected.
6. Click `Add Custom Token`.
7. Click `Import Tokens`.

Now you should see your token balance.

### Sending tokens in MetaMask

This requires [registering the token](#viewing-your-balance-in-metamask) previously.
To send tokens to another account

1. Select your account.
2. Go to `Assets` tab.
3. Click the row that has the token symbol.
4. Click the `Send` button.
5. Choose the destination account.
6. Choose the amount.
7. Click Next.
8. (Optional) Edit the gas fees.
9. Click Confirm.

Eventually, the transaction should be confirmed.

## Deployment

There is a Hardhat task that deploys the token. It is meant for both testnet and mainnet networks.

Here are step-by-step instructions for deployment. They assume an Infura JSON-RPC endpoint is used.

### Rinkeby deployment

Two accounts are needed for deployment:
- One is the proxy administrator. This is the same account that signs the deployment transactions.
- Another one is the token administrator.

These are the steps for a successful deploy on rinkeby:
1. Set the `networks` property of your [hardhat config](hardhat.config.ts) like this:
```js
{
  networks: {
    rinkeby: {
      url: "https://:your-secret@rinkeby.infura.io/v3/your-project-id",
      accounts: ["your-hex-encoded-private-key"],
    },
  },
}
```
2. Ensure your proxy administrator address has enough ether for deployment. The total deployment cost shouldn't be higher than 2M gas.
3. Invoke the Hardhat deploy task:
```sh
hh --network rinkeby dogethereum.deploy --token-admin tokenAdminAddress
```

It is highly recommended to [verify](#verification) the logic contract and the proxy contract at this point.

Once that is done, the deployment is finished.


### Mainnet deployment

TODO

### Verification

There are two types of contracts that need verification:
- Logic contracts
- Proxy contracts

#### Logic contracts

First of all, the address for the logic contract is needed. This can be found both in the transaction history of the deployer account and in the JSON file for your network in the `.openzeppelin` directory.

In the `impls` field you can find all the addresses of deployed logic contracts. Once you find the one that corresponds to the deploy you want to verify, you can run the Hardhat `verify` task to verify it.

1. Set the `etherscan` property of your [hardhat config] like this:
```js
{
  etherscan: {
    apiKey: "your-etherscan-api-key",
  },
}
```
2. Run the Hardhat verify task:
```sh
hh --network your-network verify your-logic-contract-address
```

Once that's done, it's verified. Of course, if you have more than one logic contract, you'll need to repeat the process until all of them are verified. Note that this assumes that you're verifying the `DogeToken` contract that currently has no constructor arguments. If your contract actually has constructor arguments you'll need to provide them. Refer to the `hardhat-etherscan` help by running `hh verify --help` or checking its [README](https://github.com/NomicFoundation/hardhat/tree/master/packages/hardhat-etherscan#readme).

#### Proxy contracts

It is very likely that the source code for the proxy itself was already supplied by etherscan due to it recognizing the proxy bytecode. The only step that is needed is to request Etherscan to recognize it as a proxy and to detect the implementation or logic contract.

This can be done by going to the `Contract` tab, pressing the `More Options` button and choosing the `Is this a proxy?` option.

### Upgrades

TODO


[hardhat config]: (hardhat.config.ts)