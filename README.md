# Wrapped Dogecoin (wDoge) token contract

The Dogecoin-Ethereum bridge requires a token to represent doges in the Ethereum network. This repository contains a token contract that fulfills this goal.

## System overview

The token is built on top of two contracts deployed to two separate accounts:
1. The proxy. This contract allows upgrading the token implementation.
2. The token implementation. This contract implements the ERC20 interface and a few more functions for minting, burning and transferring the ownership of the contract.

There are three user roles in the system:
- Proxy admin.
  - Can execute upgrades.
  - Cannot interact with the token functionality. E.g. the proxy admin can't transfer tokens they possess.
- Token owner.
  - Can mint and burn tokens.
  - Can transfer the "ownership" of the token contract.
- Token holder.
  - Can use any function of the ERC20 interface, plus some extra non standard functions defined in the OpenZeppelin ERC20 token implementation.

It is important to note that the proxy admin cannot be a token holder nor token owner.
On the other hand, the token owner can be a token holder too.
There is only one token owner at any given point after block execution.

## Prerequisites

- [nodejs](https://nodejs.org) [latest LTS](https://nodejs.org/en/about/releases/) or above. This is currently fermium (v14).

Optional:

- [jq](https://stedolan.github.io/jq/). This is not a hard requirement but it is recommended since some shell commands suggested in this readme use it.
- [Hardhat shorthand](https://hardhat.org/guides/shorthand.html). Several snippets assume you have installed it. In general, `hh` invocations can be replaced with a Hardhat invocation through `npx` like so: `npx hardhat`

## Installing

To run tests or deployment you need to install the root package dependencies. To do so:

- `cd` to the directory where the repo is cloned.
- Execute `npm install`.

## Running the Tests

There are unit tests for the token contract.

Use `npm test` to run them.

## Deployment

There is a Hardhat task that deploys the token system. It is meant for both Rinkeby testnet and mainnet networks.

Here are step-by-step instructions for deployment. They assume an [Infura JSON-RPC endpoint](https://infura.io) is used.

### Deployments from scratch

The deployment is meant to bail out if it detects an already existing deployment. If you want to execute a new deployment from scratch, the deployment artifact should be erased or moved elsewhere. The upgrades plugin maintains an internal manifest that tracks deployment of proxies and implementation contracts that you may want to remove too.

- Deployment artifact path: `./deployment/network-name/`
    - The network name is the name used for the network in your Hardhat config.
- Upgrades plugin manifest path: `./openzeppelin/network-name.json`
    - Sometimes, the network name may be `unknown-$chainId.json` instead if it isn't a known network.

### Rinkeby deployment

Two accounts are needed for deployment:
1. The proxy admin. This is the same account that signs the deployment transactions.
2. The token owner.

These are the steps for a successful deploy on rinkeby:
1. Register an account in [Infura] and create a project for WDoge if you don't have one.
2. Run `hh compile` to ensure the compiler output is up to date.
3. Set the `networks` property of your [hardhat config](hardhat.config.ts) like this:
```ts
const config: HardhatUserConfig = {
  networks: {
    rinkeby: {
      url: "https://:your-secret@rinkeby.infura.io/v3/your-project-id",
      accounts: ["your-hex-encoded-deployer-private-key"],
    },
  },
  // other config fields
};
```
4. Ensure your proxy admin address has enough ether for deployment. The total deployment cost shouldn't be higher than 2M gas.
5. Invoke the Hardhat deploy task:
```sh
hh --network rinkeby wdoge.deployToken --token-owner tokenOwnerAddress
```
6. (Optional) If you want to publish this deployment, track both the `deployment/rinkeby/deployment.json` artifact and the `.openzeppelin/rinkeby.json` manifest and commit them.

It is highly recommended to [verify](#etherscan-verification) the token implementation contract and the proxy contract at this point.

Once that is done, the deployment is finished.

You can print the [proxy contract state](#reading-the-proxy-state) if you want.

### Mainnet deployment

Three accounts are needed for deployment:
1. The deployer. This is an externally owned account that signs the deployment transactions.
2. The proxy admin. This should be a multisig wallet.
3. The token owner. This should be a multisig wallet.

These are the steps for a successful deploy on mainnet:
1. Register an account in [Infura] and create a project for WDoge if you don't have one.
2. Run `hh compile` to ensure the compiler output is up to date.
3. Set the `networks` property of your [hardhat config] like this:
```ts
const config: HardhatUserConfig = {
  networks: {
    mainnet: {
      url: "https://:your-secret@mainnet.infura.io/v3/your-project-id",
      accounts: ["your-hex-encoded-deployer-private-key"],
    },
  },
  // other config fields
};
```
4. Ensure your deployer address has enough ether for deployment. The total deployment cost shouldn't be higher than 2M gas. You may want to specify [base fee and priority fees](#other-deployment-options) in the next step.
5. Invoke the Hardhat deploy task:
```sh
hh --network mainnet wdoge.deployToken --token-owner tokenOwnerAddress --proxy-admin proxyAdminAddress
```
6. (Optional) If you want to publish this deployment, track both the `deployment/mainnet/deployment.json` artifact and the `.openzeppelin/mainnet.json` manifest and commit them.

It is highly recommended to [verify](#etherscan-verification) the token implementation contract and the proxy contract at this point.

Once that is done, the deployment is finished.

You can print the [proxy contract state](#reading-the-proxy-state) if you want.

### Other deployment options

The deploy task has other options that may be useful in certain network conditions. All options can be consulted by invoking:

```sh
hh wdoge.deployToken --help
```

Some of these options are:

- `--token-gas-limit`: gas limit for the token implementation contract deployment.
- `--proxy-gas-limit`: gas limit for the proxy contract deployment.
- `--max-fee-per-gas`: maximum fee per unit of gas.
- `--max-priority-fee-per-gas`: maximum priority fee per unit of gas.

## Etherscan verification

To verify a contract on Etherscan we use the hardhat-etherscan plugin. These are the inputs needed for a successful verification:

- Network used for the deployment.
- Contract address.
- Constructor arguments, if any.

There are two types of contracts that need verification:
- Implementation contracts
- Proxy contracts

Deployment artifacts store the inputs for each of these types in a different way.

The following sections ([Implementation contracts](#implementation-contracts) and [Proxy contracts](#proxy-contracts)) assume that the contract verification state in etherscan is unverified and unmatched bytecode. This means that Etherscan not only doesn't know the exact source code used to compile the deployed contract but it also doesn't recognize the bytecode as similar to any other verified contract.

If Etherscan recognizes the contract bytecode as a similar match to another verified contract, refer to the [similar match](#similar-match) section for details on how to achieve an exact match verification.

Keep in mind that you can refer to the `hardhat-etherscan` CLI help by running `hh verify --help` or checking its [README](https://github.com/NomicFoundation/hardhat/tree/master/packages/hardhat-etherscan#readme).

### Implementation contract

First of all, the address for the implementation contract is needed. We are going to verify the source code of the WDoge implementation contract.

You can get the implementation contract address for the token like this:

```sh
jq .contracts.wDoge.proxyConstructorArgs.implementationContractAddress deployment/your-network/deployment.json
```

Where `your-network` is the name of the network you used while running the deploy task, i.e. the `--network` argument.


Once you have the address of the `WDoge` contract, you can run the Hardhat `verify` task to verify its source code.

1. Set the `etherscan` property of your [hardhat config] like this:
```ts
const config: HardhatUserConfig = {
  etherscan: {
    apiKey: "your-etherscan-api-key"
  },
  // other config fields
};
```
2. Run the Hardhat verify task:
```sh
hh --network your-network verify your-WDoge-implementation-contract-address
```

Note that there are no constructor arguments for the `WDoge` implementation contract. In general, upgradeable contracts don't use constructor arguments although this may change in the future.

Once that's done, it's verified.

### Proxy contracts

We are going to verify the WDoge proxy here.

You can get the proxy contract address for the token like this:

```sh
jq .contracts.wDoge.address deployment/your-network/deployment.json
```

You also need the constructor arguments for the proxy.
The proxy constructor has the following arguments:
```solidity
constructor(address implementation, address admin, bytes memory data) {}
```

Note that you need these values as they were sent in the deployment transaction, it does not matter if the contract later modified the state variables associated with these parameters. For this reason, the deploy task stores the arguments into the deployment artifact.

1. The implementation contract address for the `WDoge` is the same one as explained [here](#implementation-contracts).
2. The admin argument is the initial proxy admin account.
3. The `data` parameter is the ABI encoded call to the initializer function in the implementation contract.

Run `jq .contracts.wDoge.proxyConstructorArgs deployment/your-network/deployment.json` to get them.

With all these you can now verify the proxy contract:

1. Ensure the `etherscan` property of your [hardhat config] contains your Etherscan API key:
```js
const config: HardhatUserConfig = {
  etherscan: {
    apiKey: "your-etherscan-api-key"
  },
  // other config fields
};
```
2. Run the Hardhat verify task:
```sh
hh --network your-network verify your-WDoge-proxy-contract-address --contract contracts/WDogeProxy.sol:WDogeProxy your-WDoge-implementation-contract-address proxy-admin-address encoded-initializer-arguments
```

This verifies the proxy source code but there is more.

Etherscan has `Read as proxy` and `Write as proxy` features that are enabled once the proxy has an associated implementation.
To enable these, it is necessary to request Etherscan to recognize the contract as a proxy and to detect the implementation contract address.

This can be done by going to the `Contract` tab, pressing the `More Options` button and choosing the `Is this a proxy?` option.


### Similar match

It is possible that the source code for the contract was already supplied by etherscan due to it recognizing the contract bytecode.

TODO

See https://info.etherscan.com/types-of-contract-verification/ and https://info.etherscan.com/update-on-similar-match-contract-verification/

## Usage

### Viewing your balance in MetaMask

1. Select your account.
2. Go to `Assets` tab.
3. Click `Import tokens`.
4. Paste the proxy contract address.
    - You can check you've got the correct address by looking at the address view of the proxy in Etherscan. Once there, you should see that the contract has the `WDogeProxy` contract name.
5. Wait for the Token Symbol and Token Decimals to be auto detected.
6. Click `Add Custom Token`.
7. Click `Import Tokens`.

Now you should see your token balance.

### Sending tokens in MetaMask

This requires you to [be able to view your balance in MetaMask](#viewing-your-balance-in-metamask).
You can send WDoge tokens just like you do with any other ERC20 token.

## Upgrades

There is an upgrade task that helps prepare an upgrade so it can be finalized using a multisig wallet or cold wallet.

The upgrade process consists of the following two transactions:

1. The new implementation contract deployment transaction.
  - This step uses the upgrades plugin.
  - The deployment transaction is skipped if there already is a deployment present in the network.
  - If you want to force a redeployment, it may be necessary to alter the upgrades plugin manifest in `.openzeppelin`.
  - If the upgrades plugin finds an incompatibility in the new implementation contract, it will abort the deployment.
2. The proxy upgrade transaction itself.
  - This transaction can call an initialization function optionally. See [this section](#specifying-migration-call) for more details.

### Preparing the upgrade

There is only one task parameter that is mandatory. The `--new-implementation-contract` parameter must be set to the name of the implementation contract. If the contract name is not unique in the contracts directory, the fully qualified name may be necessary instead. E.g. the fully qualified name for `DummyToken` is `contracts/DummyToken.sol:DummyToken`.

Let's see an example of the task usage:

```sh
$ hh --network rinkeby wdoge.upgradeToken --new-implementation-contract DummyToken
Token implementation contract is deployed at address 0x805439bc66707b4427D03062fC8379FB84f3723B.
```

Other task parameters can be seen invoking `hh wdoge.upgradeToken --help`.

In particular, you may be interested in [specifying a migration or initialization call](#specifying-migration-call) to be done when the upgrade is executed.

### Specifying migration call

The upgrade task allows you to specify the migration contract call with a javascript module.

For example, if you have a contract like this:

```solidity
struct TXO {
  bytes32 txHash;
  uint32 index;
}

contract Foo {
  function initialize(uint version, string name, TXO memory txOutput, bytes b) public { ... }
}
```

The module should look like this:
```js
module.exports = {
  name: "initialize",
  args: [
    30,
    "New name",
    {
      // bytes32 have to be 0x-prefixed
      txHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      index: 3,
    },
    // bytes have to be 0x-prefixed
    "0xcafe",
  ]
};
```

You need to pass the path of this module to the `--call-args` parameter of the `wdoge.upgradeToken` task. E.g:

```sh
hh --network rinkeby wdoge.upgradeToken --new-implementation-contract Foo --call-args initialize_params.js
```

When invoking the upgrade task, you'll see a message like this:

```
Token migration call data is 0x454b0608000000000000000000000000000000000000000000000000000000000000001e
```

You can copy and paste the hex encoded string into the `data (bytes)` field of the `upgradeToAndCall` function to invoke it atomically during the upgrade transaction.

### Dealing with a low gas price transaction

If during the upgrade preparation you find yourself with the following error:

```
An unexpected error occurred:

Error: Timed out waiting for implementation contract deployment to address 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9 with transaction 0xb5f93fb9196054fad710cfd2b69fa7c48767661967e7a0f26a6438ff645a537e

Run the function again to continue waiting for the transaction confirmation. If the problem persists, adjust the polling parameters with the timeout and pollingInterval options.
```

then the transaction probably has a low gas price for the current network conditions. By default, the `wdoge.upgradeToken` task waits for 60 seconds before timing out.

To send a transaction with higher gas price overriding the current one you can do the following:

1. Assume the tx hash is `0xb5f93fb9196054fad710cfd2b69fa7c48767661967e7a0f26a6438ff645a537e` as shown in the error.
2. Open the manifest `.openzeppelin/your-network.json`.
3. Search for the tx hash in the manifest.
It should look like this:
```
[...]
    },
    "9bf3ba1091887e531235ce3f59fa591318e88fc5024ac7cb2928665ac379a707": {
      "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      "txHash": "0xb5f93fb9196054fad710cfd2b69fa7c48767661967e7a0f26a6438ff645a537e",
[...]
```
4. Erase the entire entry that contains the `txHash` field that matches the pending tx hash.
The result should erase the key and value marked with an arrow:
```
[...]
    },
    "9bf3ba1091887e531235ce3f59fa591318e88fc5024ac7cb2928665ac379a707": {  <---------------
      "address": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      "txHash": "0xb5f93fb9196054fad710cfd2b69fa7c48767661967e7a0f26a6438ff645a537e",
[...]
```
5. Reexecute the upgrade task specifying the `--nonce`, `--max-fee-per-gas`, `--max-priority-fee-per-gas` options.
E.g:
```sh
hh --network rinkeby wdoge.upgradeToken --new-implementation-contract DummyToken --nonce 8 --max-fee-per-gas 60 --max-priority-fee-per-gas 2
```
The `nonce` option should be the same nonce as the one in tx `0xb5f93fb9196054fad710cfd2b69fa7c48767661967e7a0f26a6438ff645a537e` and `--max-fee-per-gas`, `--max-priority-fee-per-gas` should be at least 10% higher than the one in tx `0xb5f93fb9196054fad710cfd2b69fa7c48767661967e7a0f26a6438ff645a537e`.

### Executing an upgrade

This assumes that the proxy admin is a [gnosis safe](https://gnosis-safe.io/) multisig contract.

1. Open the [gnosis safe application](https://gnosis-safe.io/app/).
2. Click "New Transaction"
3. Click "Contract interaction"
4. Paste the WDoge proxy address. See [here](#reading-the-proxy-state) to get the address.
5. (Optional) This step may not be needed if the Gnosis Safe App fills in the proxy ABI for you.
  Paste the `WDogeProxy` ABI. To get the ABI:
    1. Run `hh compile` to ensure contracts are compiled.
    2. Run `jq .abi artifacts/contracts/WDogeProxy.sol/WDogeProxy.json` to get the ABI.
6. Select either `upgradeTo` or `upgradeToAndCall` as the method.
    - If there's no migration or initialization contract call then you want the `upgradeTo` method.
7. Paste the new implementation contract address in the `newImplementation` textbox.
8. (Optional) If you're using the `upgradeToAndCall`, then
    1. input the amount of ETH to send to the proxy contract in the `Value` textbox. Typically, this would be zero.
    2. input the encoded migration call in the `data` textbox.
9. Click the `Review` button.
10. Click the `Submit` button.
11. Approve the transaction so it is signed.
12. Wait until the transaction has enough confirmations.

Once it is confirmed, the transaction should have an `Upgraded` event visible in the `Logs` tab in Etherscan. You can use the [proxy inspection task](#reading-the-proxy-state) to check out the implementation address too.

After executing the upgrade, it may be necessary to issue an implementation contract address redetection in etherscan.
This can be done by going to the `Contract` tab, pressing the `More Options` button and choosing the `Is this a proxy?` option.
See [the verification section for proxies](#proxy-contracts) for more details.

## Other tools

### Reading the proxy state

You can read the WDoge proxy state by invoking the following Hardhat task:

```sh
hh --network your-network wdoge.inspectProxy
```

where `your-network` must match the network name you used to deploy the contracts.

### Getting the token implementation ABI

First, run `hh compile`. Then run `jq .abi artifacts/contracts/WDoge.sol/WDoge.json`.

[hardhat config]: (hardhat.config.ts)
[Infura]: https://infura.io/
