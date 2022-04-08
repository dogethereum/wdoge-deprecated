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
}

/**
 * This script always deploys the production token.
 */
const deployCommand: ActionType<DeployTaskArguments> = async function (
  { confirmations, tokenAdmin },
  hre
) {
  if (!hre.ethers.utils.isAddress(tokenAdmin))
    throw new Error("Invalid Ethereum address for the token administrator.");
  if (confirmations < 1) throw new Error("Confirmations can't be lower than 1.");

  const deploymentDir = getDefaultDeploymentPath(hre);
  const deploymentExists = await fs.pathExists(path.join(deploymentDir, DEPLOYMENT_JSON_NAME));

  if (deploymentExists && hre.network.name !== "hardhat") {
    // We support only one deployment for each network for now.
    throw new Error(`A deployment for ${hre.network.name} already exists.`);
  }

  const [proxyAdmin] = await hre.ethers.getSigners();

  const deployment = await deployToken(hre, proxyAdmin, {
    tokenAdmin,
    useProxy: true,
    confirmations,
  });

  console.log(`Deployed token!`);
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
    "confirmations",
    "The number of confirmations that the deploy task will wait for the tx.",
    1,
    types.int
  )
  .setAction(deployCommand);
