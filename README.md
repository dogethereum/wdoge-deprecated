# Doge token contract

The Dogecoin-Ethereum bridge requires a token to represent doges in the Ethereum network. This repository contains a token contract that fulfills this goal.

## Prerequisites

- [nodejs](https://nodejs.org) [latest LTS](https://nodejs.org/en/about/releases/) or above. This is currently fermium (v14).

Optional:

- [jq](https://stedolan.github.io/jq/). This is not a hard requirement but it is recommended since some shell commands suggested in this readme use it.
- [Hardhat shorthand](https://hardhat.org/guides/shorthand.html). Several snippets assume you have installed it. In general, `hh` invocations can be replaced with a Hardhat invocation through `npx` like so:

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

To verify a contract we use the hardhat-etherscan plugin. These are the inputs needed for a successful verification:

- Network used for the deployment.
- Contract address.
- Constructor arguments, if any.

There are two types of contracts that need verification:
- Logic contracts
- Proxy contracts

Deployment artifacts store the inputs for each of these types in a different way.

The following sections ([Logic contracts](#logic-contracts) and [Proxy contracts](#proxy-contracts)) assume that the contract verification state in etherscan is unverified and unmatched bytecode. This means that Etherscan not only doesn't know the exact source code used to compile the deployed contract but it also doesn't recognize the bytecode as similar to any other verified contract.

If Etherscan recognizes the contract bytecode as a similar match to another verified contract, refer to the [similar match](#similar-match) section for details on how to achieve an exact match verification.

#### Logic contracts

First of all, the address for the logic contract is needed. We are going to use the DogeToken logic contract as an example here.

You can get the logic contract address for the token like this:

```sh
jq .contracts.dogeToken.logicContractAddress deployment/your-network/deployment.json
```

Where `your-network` is the name of the network you used while running the deploy task, i.e. the `--network` argument.


Once you have the address of the `DogeToken` contract, you can run the Hardhat `verify` task to verify it.

1. Set the `etherscan` property of your [hardhat config] like this:
```js
{
  etherscan: {
    apiKey: "your-etherscan-api-key"
  }
}
```
2. Run the Hardhat verify task:
```sh
hh --network your-network verify your-dogetoken-logic-contract-address
```

Note that there are no constructor arguments for the `DogeToken` logic contract. In general, upgradeable contracts don't use constructor arguments although this may change in the future.

Once that's done, it's verified. Of course, if you have more than one logic contract, you'll need to repeat the process until all of them are verified. If your contract actually has constructor arguments you'll need to provide them. Refer to the `hardhat-etherscan` help by running `hh verify --help` or checking its [README](https://github.com/NomicFoundation/hardhat/tree/master/packages/hardhat-etherscan#readme).

#### Proxy contracts

We are going to use the DogeToken proxy as an example here.

You can get the proxy contract address for the token like this:

```sh
jq .contracts.dogeToken.address deployment/your-network/deployment.json
```

You also need the constructor arguments for the proxy.
The proxy constructor has the following arguments:
```solidity
constructor(address _logic, address admin_, bytes memory _data) {}
```

Note that you need these values as they were sent in the deployment transaction, it does not matter if the contract later modified the state variables associated with these parameters. For this reason, the deploy task stores the arguments into the deployment artifact.

1. The logic contract address for the `DogeToken` is the same one as explained [here](#logic-contracts). Run `jq .contracts.dogeToken.logicContractAddress deployment/your-network/deployment.json` to get it.
2. The admin argument is always the `ProxyAdmin` contract deployed by the upgrades plugin. Run `jq .contracts.dogeToken.proxyAdminContract deployment/your-network/deployment.json` to get it.
3. The `_data` field is the ABI encoded call to the initializer function in the logic contract. Run `jq .contracts.dogeToken.initData deployment/your-network/deployment.json` to get it.

With all these you can now verify the proxy contract:

1. Ensure the `etherscan` property of your [hardhat config] contains your Etherscan API key:
```js
{
  etherscan: {
    apiKey: "your-etherscan-api-key"
  }
}
```
2. Run the Hardhat verify task:
```sh
hh --network your-network verify your-dogetoken-proxy-contract-address your-dogetoken-logic-contract-address proxy-admin-contract-address encoded-initializer-arguments
```

This verifies the proxy source code but there is more.

Etherscan has `Read as proxy` and `Write as proxy` features that are enabled once the proxy has an associated implementation.
To enable these, it is necessary to request Etherscan to recognize the contract as a proxy and to detect the implementation or logic contract address.

This can be done by going to the `Contract` tab, pressing the `More Options` button and choosing the `Is this a proxy?` option.





#### Similar match

It is possible that the source code for the contract was already supplied by etherscan due to it recognizing the contract bytecode.

TODO

See https://info.etherscan.com/types-of-contract-verification/ and https://info.etherscan.com/update-on-similar-match-contract-verification/

### Upgrades

TODO


[hardhat config]: (hardhat.config.ts)