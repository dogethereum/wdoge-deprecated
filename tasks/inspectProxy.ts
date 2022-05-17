import chalk from "chalk";
import fs from "fs-extra";
import { task } from "hardhat/config";
import type { ActionType } from "hardhat/types";
import path from "path";

import { DEPLOYMENT_JSON_NAME, getDefaultDeploymentPath, loadDeployment } from "../deploy";

import { generateTaskName } from "./common";

const inspectProxyCommand: ActionType<unknown> = async function (ignored, hre) {
  const deploymentDir = getDefaultDeploymentPath(hre);
  const deploymentExists = await fs.pathExists(path.join(deploymentDir, DEPLOYMENT_JSON_NAME));

  if (!deploymentExists) {
    throw new Error(
      `A deployment for the ${hre.network.name} network was not found.
Ensure the correct network is passed to the --network parameter.`
    );
  }

  const { wDoge } = await loadDeployment(hre, deploymentDir);

  console.log(`WDoge proxy:
  Proxy address is ${chalk.green(wDoge.contract.address)}
  Proxy admin is ${chalk.green(wDoge.proxyAdmin)}
  Token owner is ${chalk.green(wDoge.tokenAdmin)}
  Token implementation address is ${chalk.green(wDoge.logicContractAddress)}`);
};

export const inspectProxyTaskName = generateTaskName("inspectProxy");

task(inspectProxyTaskName, "Inspects proxy contract state.").setAction(inspectProxyCommand);
