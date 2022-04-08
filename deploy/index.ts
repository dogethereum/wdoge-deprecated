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
  /**
   * Proxy admin signer, if any.
   */
  proxyAdmin?: SignerWithAddress;
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
}
type InitializerArguments = any[];

export interface UserDeploymentOptions {
  /**
   * Number of block confirmations to wait for when deploying a contract.
   */
  confirmations?: number;
  /**
   * Use transparent proxies to deploy main contracts
   */
  useProxy?: boolean;
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
  { contract, name }: DogethereumContract
) {
  const artifact = await hre.artifacts.readArtifact(name);
  return {
    abi: artifact.abi,
    contractName: artifact.contractName,
    sourceName: artifact.sourceName,
    address: contract.address,
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

const deployProxy: DeployF = async (hre, factory, { initArguments, confirmations }) => {
  const contract = await hre.upgrades.deployProxy(factory, initArguments, {
    kind: "transparent",
  });
  await contract.deployTransaction.wait(confirmations);
  const address = await factory.signer.getAddress();
  return { contract, proxyAdmin: await hre.ethers.getSigner(address) };
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
  confirmations = 0,
  deployPrimitive = deployPlain
): Promise<DeployOutput> {
  // TODO: `getContractFactory` gets a default signer so we may want to remove this.
  if (options.signer === undefined) {
    throw new Error("No wallet or signer defined for deployment.");
  }

  const factory = await hre.ethers.getContractFactory(contractName, options);
  return deployPrimitive(hre, factory, {
    initArguments,
    confirmations,
  });
}

export async function deployToken(
  hre: HardhatRuntimeEnvironment,
  deploySigner: ethers.Signer,
  { tokenAdmin, confirmations = 0, useProxy = true }: TokenV1Options & UserDeploymentOptions
): Promise<DogethereumTokenSystem> {
  const contractName = "DogeToken";
  const dogeToken = await deployContract(
    contractName,
    [tokenAdmin],
    hre,
    { signer: deploySigner },
    confirmations,
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
  const {dogeToken} = await deployToken(hre, proxyAdmin, { tokenAdmin: tokenAdmin.address });
  dogethereumFixture = {
    dogeToken: {
      ...dogeToken,
      tokenAdmin,
    }
  }
  return dogethereumFixture;
}
