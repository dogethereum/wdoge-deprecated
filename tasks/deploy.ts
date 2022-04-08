import fs from "fs-extra";
import { task, types } from "hardhat/config";
import { ActionType } from "hardhat/types";
import path from "path";

import {
  deployToken,
  DEPLOYMENT_JSON_NAME,
  getDefaultDeploymentPath,
  storeDeployment,
} from "../deploy";

export interface DeployTaskArguments {
  confirmations: number;
  tokenAdmin: string;
  proxyAdmin?: string;
}

/**
 * This script always deploys the production token.
 */
const deployCommand: ActionType<DeployTaskArguments> = async function (
  { confirmations, tokenAdmin, proxyAdmin },
  hre
) {
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
  });

  console.log(`Deployed token!`);

  if (proxyAdmin !== undefined) {
    await hre.upgrades.admin.changeProxyAdmin(deployment.dogeToken.contract.address, proxyAdmin);
    console.log(`Transferred proxy administration to ${proxyAdmin}`);
  }
  return storeDeployment(hre, deployment, deploymentDir);
};

task("dogethereum.deploy", "Deploys doge token.")
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
  .setAction(deployCommand);
