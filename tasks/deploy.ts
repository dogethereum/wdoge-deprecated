import fs from "fs-extra";
import { task, types } from "hardhat/config";
import type { ActionType } from "hardhat/types";
import path from "path";

import {
  deployToken,
  DEPLOYMENT_JSON_NAME,
  getDefaultDeploymentPath,
  storeDeployment,
} from "../deploy";

import { generateTaskName } from "./common";

export interface DeployTokenTaskArguments {
  confirmations: number;
  tokenAdmin: string;
  proxyAdmin?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  proxyGasLimit?: number;
  tokenGasLimit?: number;
}

/**
 * This script always deploys the production token.
 */
const deployCommand: ActionType<DeployTokenTaskArguments> = async function (
  {
    confirmations,
    tokenAdmin,
    proxyAdmin,
    tokenGasLimit,
    proxyGasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  },
  hre
) {
  if (xor(maxFeePerGas !== undefined, maxPriorityFeePerGas !== undefined)) {
    throw new Error(
      "Both `max-fee-per-gas` and `max-priority-fee-per-gas` must be defined when overriding gas fees."
    );
  }
  // TODO: validate maxFeePerGas and maxPriorityFeePerGas

  if (!hre.ethers.utils.isAddress(tokenAdmin)) {
    throw new Error("Invalid Ethereum address for the token administrator.");
  }
  if (proxyAdmin !== undefined && !hre.ethers.utils.isAddress(proxyAdmin)) {
    throw new Error("Invalid Ethereum address for the proxy administrator.");
  }
  if (confirmations < 1) throw new Error("Confirmations can't be lower than 1.");

  const deploymentDir = getDefaultDeploymentPath(hre);
  const deploymentExists = await fs.pathExists(path.join(deploymentDir, DEPLOYMENT_JSON_NAME));

  if (deploymentExists && hre.network.name !== "hardhat") {
    // We support only one deployment for each network for now.
    throw new Error(`A deployment for ${hre.network.name} already exists.`);
  }

  const [deployer] = await hre.ethers.getSigners();
  const deployment = await deployToken(hre, deployer, {
    tokenAdmin,
    useProxy: true,
    confirmations,
    ...(maxFeePerGas !== undefined && {
      maxFeePerGas: hre.ethers.utils.parseUnits(maxFeePerGas, "gwei"),
    }),
    ...(maxPriorityFeePerGas !== undefined && {
      maxPriorityFeePerGas: hre.ethers.utils.parseUnits(maxPriorityFeePerGas, "gwei"),
    }),
    ...(proxyGasLimit !== undefined && { proxyGasLimit }),
    ...(tokenGasLimit !== undefined && { logicGasLimit: tokenGasLimit }),
    ...(proxyAdmin !== undefined && { proxyAdmin }),
  });

  console.log(`Deployed token!
  Token address is ${deployment.dogeToken.contract.address}.
  Token administrator is ${tokenAdmin}.
  Proxy administrator is ${proxyAdmin || deployer.address}.
  The proxy currently forwards calls to implementation contract at address ${
    deployment.dogeToken.logicContractAddress
  }`);

  return storeDeployment(hre, deployment, deploymentDir);
};

export const deployTaskName = generateTaskName("deployToken");

task(deployTaskName, "Deploys doge token.")
  .addParam(
    "tokenAdmin",
    `The Ethereum address of the token administrator. This account can mint and burn tokens.`,
    undefined,
    types.string
  )
  .addOptionalParam(
    "proxyAdmin",
    `The Ethereum address of the proxy administrator. If unspecified, the tx signer will be the proxy admin.`,
    undefined,
    types.string
  )
  .addOptionalParam(
    "confirmations",
    "The number of confirmations that the deploy task will wait for the tx.",
    1,
    types.int
  )
  .addOptionalParam(
    "maxFeePerGas",
    "The maximum amount of fees paid per unit of gas in Gwei." +
      " Setting this requires setting max-priority-fee-per-gas too.",
    undefined,
    types.string
  )
  .addOptionalParam(
    "maxPriorityFeePerGas",
    "The maximum amount of priority fees paid per unit of gas in Gwei." +
      " Setting this requires setting max-fee-per-gas too.",
    undefined,
    types.string
  )
  .addOptionalParam(
    "proxyGasLimit",
    "The maximum amount of gas allowed in proxy deploy tx execution. Autodetected if not set.",
    undefined,
    types.int
  )
  .addOptionalParam(
    "tokenGasLimit",
    "The maximum amount of gas allowed in token logic deploy tx execution. Autodetected if not set.",
    undefined,
    types.int
  )
  .setAction(deployCommand);

function xor(a: boolean, b: boolean): boolean {
  return a !== b;
}
