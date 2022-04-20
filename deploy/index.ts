import type ethers from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { FactoryOptions } from "@nomiclabs/hardhat-ethers/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs-extra";
import path from "path";

interface DeployOutput {
  /**
   * Object representing a concrete deployment of the contract.
   */
  contract: ethers.Contract;
  // TODO: the following three fields should be all defined or all undefined.
  /**
   * Proxy administrator address, if any.
   */
  proxyAdmin?: string;
  /**
   * Encoded call data for the initialization function used in the proxy constructor.
   */
  initData?: string;
}

export interface DogethereumContract extends DeployOutput {
  /**
   * This is the name of the contract in this project.
   * @dev The fully qualified name should be used if the contract name is not unique.
   */
  name: string;
}

export type DogethereumToken = DogethereumContract & TokenV1Options;
export type DogethereumTestToken = DogethereumContract & TokenV1Fixture;

export interface TokenV1Options {
  /**
   * Ethereum account with token mint and burn privileges.
   */
  tokenAdmin: string;
}

export interface TokenV1Fixture {
  /**
   * Signer with token mint and burn privileges.
   */
  tokenAdmin: SignerWithAddress;
}

export interface DogethereumTokenSystem {
  dogeToken: DogethereumToken;
}
export interface DogethereumTokenFixture {
  dogeToken: DogethereumTestToken;
}

export interface ContractOptions {
  initArguments: InitializerArguments;
  confirmations: number;
  maxFeePerGas?: ethers.BigNumber;
  maxPriorityFeePerGas?: ethers.BigNumber;
  logicGasLimit?: number;
  proxyGasLimit?: number;
  proxyAdmin?: string;
}
type InitializerArguments = any[];

export type UserDeploymentOptions = UserDeploymentOptionsGeneric & AllUserDeploymentOptions;
type AllUserDeploymentOptions =
  | UserProxyDeploymentOptions
  | UserPlainDeploymentOptions
  | UnspecifiedKindDeploymentOptions;
interface UnspecifiedKindDeploymentOptions {
  useProxy?: never;
}

interface UserDeploymentOptionsGeneric {
  /**
   * Number of block confirmations to wait for when deploying a contract.
   */
  confirmations?: number;
  /**
   * Use transparent proxies to deploy main contracts
   */
  useProxy?: boolean;
  /**
   * Maximum fee per unit of gas burnt. See EIP 1559.
   */
  maxFeePerGas?: ethers.BigNumber;
  /**
   * Maximum priority fee per unit of gas paid to miner. See EIP 1559.
   */
  maxPriorityFeePerGas?: ethers.BigNumber;
  /**
   * Maximum amount of gas allowed for logic contract deployment.
   */
  logicGasLimit?: number;
}

interface UserProxyDeploymentOptions {
  useProxy: true;
  /**
   * Maximum amount of gas allowed for proxy contract deployment.
   * Keep in mind that this gas is used for proxy account initialization too.
   */
  proxyGasLimit?: number;
}

interface UserPlainDeploymentOptions {
  useProxy: false;
}

type DeployF = (
  hre: HardhatRuntimeEnvironment,
  factory: ethers.ContractFactory,
  options: ContractOptions
) => Promise<DeployOutput>;

interface ContractInfo {
  abi: any[];
  contractName: string;
  sourceName: string;
  address: string;
}

interface DeploymentInfo {
  chainId: number;
  contracts: {
    dogeToken: ContractInfo;
  };
}

export const DEPLOYMENT_JSON_NAME = "deployment.json";

export function getDefaultDeploymentPath(hre: HardhatRuntimeEnvironment): string {
  return path.join(hre.config.paths.root, "deployment", hre.network.name);
}

async function getContractDescription(
  hre: HardhatRuntimeEnvironment,
  { contract, name, proxyAdmin, initData }: DogethereumContract
) {
  const artifact = await hre.artifacts.readArtifact(name);
  return {
    abi: artifact.abi,
    contractName: artifact.contractName,
    sourceName: artifact.sourceName,
    address: contract.address,
    ...(proxyAdmin !== undefined && {
      logicContractAddress: await hre.upgrades.erc1967.getImplementationAddress(contract.address),
      proxyAdmin,
      initData,
    }),
  };
}

export async function storeDeployment(
  hre: HardhatRuntimeEnvironment,
  { dogeToken }: DogethereumTokenSystem,
  deploymentDir: string
): Promise<void> {
  const deploymentInfo: DeploymentInfo = {
    chainId: hre.ethers.provider.network.chainId,
    contracts: {
      dogeToken: await getContractDescription(hre, dogeToken),
    },
  };
  // TODO: store debugging symbols such as storage layout, contract types, source mappings, etc too.

  await fs.ensureDir(deploymentDir);

  const deploymentJsonPath = path.join(deploymentDir, DEPLOYMENT_JSON_NAME);
  await fs.writeJson(deploymentJsonPath, deploymentInfo);
}

const deployProxy: DeployF = async (
  hre,
  logicFactory,
  {
    initArguments,
    confirmations,
    maxFeePerGas,
    maxPriorityFeePerGas,
    logicGasLimit,
    proxyGasLimit,
    proxyAdmin,
  }
) => {
  if (proxyAdmin === undefined) {
    proxyAdmin = await logicFactory.signer.getAddress();
  }

  const proxyFactory = await hre.ethers.getContractFactory(
    "contracts/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    logicFactory.signer
  );
  const contract = await hre.upgrades.deployProxy(logicFactory, initArguments, {
    kind: "transparent",
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
    transparentProxy: {
      ...(proxyGasLimit !== undefined && { gasLimit: proxyGasLimit }),
      factory: proxyFactory,
    },
    ...(logicGasLimit !== undefined && { implementationGasLimit: logicGasLimit }),
    proxyAdmin,
  });
  await contract.deployTransaction.wait(confirmations);
  return {
    contract,
    proxyAdmin,
    initData: logicFactory.interface.encodeFunctionData("initialize", initArguments),
  };
};

const deployPlain: DeployF = async (hre, factory, { initArguments, confirmations }) => {
  const contract = await factory.deploy(...initArguments);
  await contract.deployTransaction.wait(confirmations);
  return { contract };
};

/**
 * @dev Note that this deploy primitive is NOT for production use.
 */
const deployPlainWithInit: DeployF = async (hre, factory, { initArguments, confirmations }) => {
  const contract = await factory.deploy();
  await contract.deployTransaction.wait(confirmations);
  const initTx = (await contract.initialize(...initArguments)) as ethers.ContractTransaction;
  await initTx.wait(confirmations);
  return { contract };
};

export async function deployContract(
  contractName: string,
  initArguments: InitializerArguments,
  hre: HardhatRuntimeEnvironment,
  options: FactoryOptions = {},
  { confirmations = 0, ...deployOptions }: UserDeploymentOptions,
  deployPrimitive = deployPlain
): Promise<DeployOutput> {
  if (options.signer === undefined) {
    throw new Error("No wallet or signer defined for deployment.");
  }

  const factory = await hre.ethers.getContractFactory(contractName, options);
  return deployPrimitive(hre, factory, {
    initArguments,
    confirmations,
    ...deployOptions,
  });
}

export async function deployToken(
  hre: HardhatRuntimeEnvironment,
  deploySigner: ethers.Signer,
  { tokenAdmin, useProxy = true, ...txOverrides }: TokenV1Options & UserDeploymentOptions
): Promise<DogethereumTokenSystem> {
  const contractName = "DogeToken";
  const dogeToken = await deployContract(
    contractName,
    [tokenAdmin],
    hre,
    { signer: deploySigner },
    txOverrides,
    useProxy ? deployProxy : deployPlainWithInit
  );
  return {
    dogeToken: {
      ...dogeToken,
      name: contractName,
      tokenAdmin,
    },
  };
}

let dogethereumFixture: DogethereumTokenFixture;

/**
 * This deploys the Dogethereum system the first time it's called.
 * Meant to be used in a test suite.
 * In particular, it will deploy the DogeTokenForTests and ScryptCheckerDummy contracts.
 * @param hre The Hardhat runtime environment where the deploy takes place.
 */
export async function deployFixture(
  hre: HardhatRuntimeEnvironment
): Promise<DogethereumTokenFixture> {
  if (dogethereumFixture !== undefined) return dogethereumFixture;
  const signers = await hre.ethers.getSigners();
  const proxyAdmin = signers[signers.length - 1];
  const tokenAdmin = signers[0];
  const { dogeToken } = await deployToken(hre, proxyAdmin, { tokenAdmin: tokenAdmin.address });
  dogethereumFixture = {
    dogeToken: {
      ...dogeToken,
      tokenAdmin,
    },
  };
  return dogethereumFixture;
}
