import type ethers from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { FactoryOptions } from "@nomiclabs/hardhat-ethers/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

export interface TokenV1Options {
  /**
   * Signer with token mint and burn privileges.
   */
  tokenAdmin: SignerWithAddress;
}

export interface DogethereumTokenSystem {
  dogeToken: DogethereumToken;
}
export type TokenFixture = DogethereumTokenSystem;

export interface ContractOptions {
  initArguments: InitializerArguments;
  confirmations: number;
}
type InitializerArguments = any[];

type DeployF = (
  hre: HardhatRuntimeEnvironment,
  factory: ethers.ContractFactory,
  options: ContractOptions
) => Promise<DeployOutput>;

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
  tokenContractName: "DogeToken" | "DogeTokenForTests",
  deploySigner: ethers.Signer,
  { tokenAdmin }: TokenV1Options,
  confirmations = 0,
  tokenDeployPrimitive = deployPlainWithInit
): Promise<DogethereumTokenSystem> {
  const dogeToken = await deployContract(
    tokenContractName,
    [tokenAdmin.address],
    hre,
    { signer: deploySigner },
    confirmations,
    tokenDeployPrimitive
  );
  return {
    dogeToken: {
      ...dogeToken,
      name: tokenContractName,
      tokenAdmin,
    },
  };
}

let dogethereumFixture: TokenFixture;

/**
 * This deploys the Dogethereum system the first time it's called.
 * Meant to be used in a test suite.
 * In particular, it will deploy the DogeTokenForTests and ScryptCheckerDummy contracts.
 * @param hre The Hardhat runtime environment where the deploy takes place.
 */
export async function deployFixture(hre: HardhatRuntimeEnvironment): Promise<TokenFixture> {
  if (dogethereumFixture !== undefined) return dogethereumFixture;
  const signers = await hre.ethers.getSigners();
  const proxyAdmin = signers[signers.length - 1];
  const tokenAdmin = signers[0];
  const tokenName = "DogeToken";
  const dogeToken = await deployToken(hre, tokenName, proxyAdmin, { tokenAdmin }, 0, deployProxy);
  dogethereumFixture = dogeToken;
  return dogethereumFixture;
}
