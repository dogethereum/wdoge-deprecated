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

  const { dogeToken } = await loadDeployment(hre, deploymentDir);

  console.log(`WDoge proxy:
  Token address is ${chalk.green(dogeToken.contract.address)}
  Token administrator is ${chalk.green(dogeToken.tokenAdmin)}
  Proxy administrator is ${chalk.green(dogeToken.proxyAdmin)}
  The proxy currently forwards calls to implementation contract at address ${chalk.green(
    dogeToken.logicContractAddress
  )}`);
};

export const inspectProxyTaskName = generateTaskName("inspectProxy");

task(inspectProxyTaskName, "Inspects proxy contract state.").setAction(inspectProxyCommand);
