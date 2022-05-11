import type ethers from "ethers";
import type { HardhatRuntimeEnvironment, CompilerOutputContract } from "hardhat/types";
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
  /**
   * Address of the logic contract if this is a proxy.
   */
  logicContractAddress?: string;
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

export type ContractOptions = ContractOptionsSimple & TxOverrides;

interface ContractOptionsSimple {
  initArguments: ContractCallArguments;
  confirmations: number;
  proxyGasLimit?: number;
  proxyAdmin?: string;
}
export type ContractCallArguments = unknown[];

export type UserDeploymentOptions = UserDeploymentOptionsGeneric &
  TxOverrides &
  AllUserDeploymentOptions;
type AllUserDeploymentOptions =
  | UserProxyDeploymentOptions
  | UserPlainDeploymentOptions
  | UnspecifiedKindDeploymentOptions;
interface UnspecifiedKindDeploymentOptions {
  useProxy?: never;
}

interface TxOverrides {
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
  /**
   * The Ethereum tx nonce. This is a sequence number associated with the signing account.
   */
  nonce?: number;
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

/**
 * This type describes the deployment artifact.
 */
interface DeploymentInfo {
  chainId: number;
  contracts: {
    dogeToken: ContractInfo;
  };
}

/**
 * This type describes the deployment artifact information for a contract.
 * Note that this is not an exhaustive description.
 * The actual artifact may have additional fields.
 */
interface ContractInfo {
  abi: unknown[];
  contractName: string;
  sourceName: string;
  address: string;
  bytecodeAndSymbols: CompilerOutputContract["evm"];
}

export interface UpgradePreparation {
  /**
   * Implementation contract address.
   */
  implementation: string;
  /**
   *  ABI encoded call data for initializer function.
   */
  initData?: string;
}

export interface ContractCall {
  name: string;
  args: ContractCallArguments;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const DEPLOYMENT_JSON_NAME = "deployment.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assertContractCall(obj: any): asserts obj is ContractCall {
  if (typeof obj.name !== "string")
    throw new Error("Contract call descriptor must have a 'name' field of type string.");
  if (!Array.isArray(obj.args))
    throw new Error(
      "Contract call descriptor must have an array of arguments in the 'args' field."
    );
}

export function getDefaultDeploymentPath(hre: HardhatRuntimeEnvironment): string {
  return path.join(hre.config.paths.root, "deployment", hre.network.name);
}

async function getContractDescription(
  hre: HardhatRuntimeEnvironment,
  { contract, name, proxyAdmin, initData, logicContractAddress }: DogethereumContract
): Promise<ContractInfo> {
  const { sourceName, contractName, abi } = await hre.artifacts.readArtifact(name);
  const fqName = `${sourceName}:${contractName}`;
  const build = await hre.artifacts.getBuildInfo(fqName);
  if (build === undefined) {
    throw new Error(`Build info not found for ${fqName} contract`);
  }
  const bytecodeAndSymbols = build.output.contracts[sourceName][contractName].evm;

  return {
    abi: abi,
    contractName: contractName,
    sourceName: sourceName,
    address: contract.address,
    ...(proxyAdmin !== undefined && {
      logicContractAddress,
      proxyAdmin,
      initData,
    }),
    bytecodeAndSymbols,
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

async function reifyContract(
  hre: HardhatRuntimeEnvironment,
  { abi, address, contractName }: ContractInfo
) {
  const contract = await hre.ethers.getContractAt(abi, address);
  return {
    name: contractName,
    contract,
  };
}

export async function loadDeployment(
  hre: HardhatRuntimeEnvironment,
  deploymentDir: string = getDefaultDeploymentPath(hre)
): Promise<DogethereumTokenSystem> {
  const deploymentInfoPath = path.join(deploymentDir, DEPLOYMENT_JSON_NAME);
  const deploymentInfo: Readonly<DeploymentInfo> = await fs.readJson(deploymentInfoPath);

  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (chainId !== deploymentInfo.chainId) {
    throw new Error(
      `Expected a deployment for network with chainId ${chainId}
but found chainId ${deploymentInfo.chainId} instead.`
    );
  }

  const dogeToken = await reifyContract(hre, deploymentInfo.contracts.dogeToken);

  return {
    dogeToken: {
      ...dogeToken,
      tokenAdmin: await dogeToken.contract
        .connect(hre.ethers.provider)
        .owner({ from: ZERO_ADDRESS }),
      proxyAdmin: await hre.upgrades.erc1967.getAdminAddress(dogeToken.contract.address),
      logicContractAddress: await hre.upgrades.erc1967.getImplementationAddress(
        dogeToken.contract.address
      ),
    },
  };
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
    nonce,
  }
) => {
  if (proxyAdmin === undefined) {
    proxyAdmin = await logicFactory.signer.getAddress();
  }

  const proxyFactory = await hre.ethers.getContractFactory("WDogeProxy", logicFactory.signer);
  const contract = await hre.upgrades.deployProxy(logicFactory, initArguments, {
    kind: "transparent",
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
    transparentProxy: {
      ...(proxyGasLimit !== undefined && { gasLimit: proxyGasLimit }),
      factory: proxyFactory,
    },
    ...(logicGasLimit !== undefined && { implementationGasLimit: logicGasLimit }),
    ...(nonce !== undefined && { nonce }),
    proxyAdmin,
    // This ensures there's no error thrown for taking too long to confirm a transaction.
    // Alternatively, we could handle partial deploys better than we do now.
    timeout: 0,
  });
  await contract.deployTransaction.wait(confirmations);
  return {
    contract,
    proxyAdmin,
    initData: logicFactory.interface.encodeFunctionData("initialize", initArguments),
    logicContractAddress: await hre.upgrades.erc1967.getImplementationAddress(contract.address),
  };
};

const deployPlain: DeployF = async (
  hre,
  factory,
  { initArguments, confirmations, maxFeePerGas, maxPriorityFeePerGas, nonce, logicGasLimit }
) => {
  const contract = await factory.deploy(...initArguments, {
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
    ...(logicGasLimit !== undefined && { gasLimit: logicGasLimit }),
    ...(nonce !== undefined && { nonce }),
  });
  await contract.deployTransaction.wait(confirmations);
  return { contract };
};

/**
 * @dev Note that this deploy primitive is NOT for production use.
 */
const deployPlainWithInit: DeployF = async (
  hre,
  factory,
  { initArguments, confirmations, maxFeePerGas, maxPriorityFeePerGas, nonce, logicGasLimit }
) => {
  const contract = await factory.deploy({
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
    ...(logicGasLimit !== undefined && { gasLimit: logicGasLimit }),
    ...(nonce !== undefined && { nonce }),
  });
  await contract.deployTransaction.wait(confirmations);
  const initTx: ethers.ContractTransaction = await contract.initialize(...initArguments, {
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
    // TODO: actually use another gas limit for the initialization step?
    ...(logicGasLimit !== undefined && { gasLimit: logicGasLimit }),
    ...(nonce !== undefined && { nonce: nonce + 1 }),
  });
  await initTx.wait(confirmations);
  return { contract };
};

export async function deployContract(
  contractName: string,
  initArguments: ContractCallArguments,
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
  const contractName = "WDoge";
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

export async function prepareUpgradeToken(
  hre: HardhatRuntimeEnvironment,
  implementationFactory: ethers.ContractFactory,
  dogeTokenProxy: string,
  { maxFeePerGas, maxPriorityFeePerGas, logicGasLimit }: UserDeploymentOptions,
  callDescriptor?: ContractCall
): Promise<UpgradePreparation> {
  const upgrade: Partial<UpgradePreparation> = {};
  if (callDescriptor !== undefined) {
    const functionFragment = implementationFactory.interface.functions[callDescriptor.name];
    if (functionFragment === undefined) {
      throw new Error(`Function ${callDescriptor.name} not found in implementation ABI.`);
    }
    upgrade.initData = implementationFactory.interface.encodeFunctionData(
      functionFragment,
      callDescriptor.args
    );
  }

  const implementation = await hre.upgrades.prepareUpgrade(dogeTokenProxy, implementationFactory, {
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
    ...(logicGasLimit !== undefined && { implementationGasLimit: logicGasLimit }),
  });

  return { ...upgrade, implementation };
}

let dogethereumFixture: DogethereumTokenFixture;

/**
 * This deploys the Dogethereum system the first time it's called.
 * Meant to be used in a test suite.
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
