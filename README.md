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
4. Paste the token contract address. The contract should have the `DogethereumProxy` contract name.
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

### Getting the token ABI

First, run `hh compile`. Then run `jq .abi artifacts/contracts/DogeToken.sol/DogeToken.json`.

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
hh --network rinkeby dogethereum.deployToken --token-admin tokenAdminAddress
```

It is highly recommended to [verify](#verification) the logic contract and the proxy contract at this point.

Once that is done, the deployment is finished.

You can print the [proxy contract state](#reading-the-proxy-state) if you want.

### Mainnet deployment

Three accounts are needed for deployment:
- An externally owned account that signs the deployment transactions. We will call it the deployer address.
- One is the proxy administrator. This should be a multisig wallet.
- Another one is the token administrator. This should be a multisig wallet.

These are the steps for a successful deploy on mainnet:
1. Set the `networks` property of your [hardhat config] like this:
```js
{
  networks: {
    mainnet: {
      url: "https://:your-secret@mainnet.infura.io/v3/your-project-id",
      accounts: ["your-hex-encoded-private-key"],
    },
  },
}
```
2. Ensure your deployer address has enough ether for deployment. The total deployment cost shouldn't be higher than 2M gas. You may want to specify [base fee and priority fees](#other-deployment-options) in the next step.
3. Invoke the Hardhat deploy task:
```sh
hh --network mainnet dogethereum.deployToken --token-admin tokenAdminAddress --proxy-admin proxyAdminAddress
```

### Other deployment options

The deploy task has other options that may be useful in certain network conditions. All options can be consulted by invoking:

```sh
hh dogethereum.deployToken --help
```

Some of these options are:

- `--token-gas-limit`: gas limit for the token logic contract deployment.
- `--proxy-gas-limit`: gas limit for the proxy contract deployment.
- `--max-fee-per-gas`: maximum fee per unit of gas.
- `--max-priority-fee-per-gas`: maximum priority fee per unit of gas.

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
2. The admin argument is the initial administrator account. Run `jq .contracts.dogeToken.proxyAdmin deployment/your-network/deployment.json` to get it.
3. The `_data` parameter is the ABI encoded call to the initializer function in the logic contract. Run `jq .contracts.dogeToken.initData deployment/your-network/deployment.json` to get it.

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
hh --network your-network verify your-dogetoken-proxy-contract-address your-dogetoken-logic-contract-address proxy-admin-address encoded-initializer-arguments
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

There is an upgrade task that helps prepare an upgrade so it can be finalized using a multisig wallet or cold wallet.

The upgrade process consists of the following two transactions:

1. The new logic contract deployment transaction.
  - This step uses the upgrades plugin.
  - The deployment transaction is skipped if there already is a deployment present in the network.
  - If you want to force a redeployment, it may be necessary to alter the upgrades plugin manifest in `.openzeppelin`.
  - If the upgrades plugin finds an incompatibility in the new logic contract, it will abort the deployment.
2. The proxy upgrade transaction itself.
  - This transaction can call an initialization function optionally. See [this section](#specifying-migration-call) for more details.

#### Preparing the upgrade

There is only one task parameter that is mandatory. The `--new-logic-contract` parameter must be set to the name of the logic contract. If the contract name is not unique in the contracts directory, the fully qualified name may be necessary instead. E.g. the fully qualified name for `DummyToken` is `contracts/DummyToken.sol:DummyToken`.

Let's see an example of the task usage:

```sh
$ hh --network rinkeby dogethereum.upgradeToken --new-logic-contract DummyToken
Token logic is deployed at address 0x805439bc66707b4427D03062fC8379FB84f3723B.
```

Other task parameters can be seen invoking `hh dogethereum.upgradeToken --help`.

In particular, you may be interested in [specifying a migration or initialization call](#specifying-migration-call) to be done when the upgrade is executed.

#### Specifying migration call

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

You need to pass the path of this module to the `--call-args` parameter of the `dogethereum.upgradeToken` task. E.g:

```sh
hh --network rinkeby dogethereum.upgradeToken --new-logic-contract Foo --call-args initialize_params.js
```

When invoking the upgrade task, you'll see a message like this:

```
Token migration call data is 0x454b0608000000000000000000000000000000000000000000000000000000000000001e
```

You can copy and paste the hex encoded string into the `data (bytes)` field of the `upgradeToAndCall` function to invoke it atomically during the upgrade transaction.

#### Executing an upgrade

This assumes that the proxy administrator is a [gnosis safe](https://gnosis-safe.io/) multisig contract.

1. Open the [gnosis safe application](https://gnosis-safe.io/app/).
2. Click "New Transaction"
3. Click "Contract interaction"
4. Paste the DogeToken proxy address. See [here](#reading-the-proxy-state) to get the address.
5. Paste the `DogethereumProxy` ABI. To get the ABI:
  1. Run `hh compile` to ensure contracts are compiled.
  2. Run `jq .abi artifacts/contracts/DogethereumProxy.sol/DogethereumProxy.json` to get the ABI.
6. Select either `upgradeTo` or `upgradeToAndCall` as the method.
  - If there's no migration or initialization contract call then you want the `upgradeTo` method.
7. Paste the new logic contract address in the `newImplementation` textbox.
8. (Optional) If you're using the `upgradeToAndCall`, then
  1. input the amount of ETH to send in the `Value` textbox.
  2. input the encoded migration call in the `data` textbox.
9. Click the `Preview` button.
10. Click the `Submit` button.
11. Approve the transaction so it is signed.
12. Wait until the transaction has enough confirmations.

Once it is confirmed, the transaction should have an `Upgraded` event visible in the `Logs` tab in Etherscan. You can use the [proxy inspection task](#reading-the-proxy-state) to check out the implementation address too.

After executing the upgrade, it is important to issue a logic contract address redetection in etherscan.
This can be done by going to the `Contract` tab, pressing the `More Options` button and choosing the `Is this a proxy?` option.
See [the verification section for proxies](#proxy-contracts) for more details.

## Other tools

### Reading the proxy state

You can read the DogeToken proxy state by invoking the following Hardhat task:

```sh
hh --network your-network dogethereum.inspectProxy
```

where `your-network` must match the network name you used to deploy the contracts.

[hardhat config]: (hardhat.config.ts)