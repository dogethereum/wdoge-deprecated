import fs from "fs-extra";
import { task, types } from "hardhat/config";
import type { ActionType } from "hardhat/types";
import path from "path";

import {
  ContractCall,
  assertContractCall,
  loadDeployment,
  prepareUpgradeToken,
  DEPLOYMENT_JSON_NAME,
  getDefaultDeploymentPath,
} from "../deploy";

import { generateTaskName, xor } from "./common";

export interface UpgradeTokenTaskArguments {
  confirmations: number;
  newLogicContract: string;
  callArgs?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  tokenGasLimit?: number;
}

/**
 * This script always deploys the production token.
 */
const upgradeCommand: ActionType<UpgradeTokenTaskArguments> = async function (
  {
    confirmations,
    newLogicContract,
    callArgs: callArgsModule,
    tokenGasLimit,
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

  const callArgs = callArgsModule !== undefined ? await readCall(callArgsModule) : undefined;
  const logicFactory = await hre.ethers.getContractFactory(newLogicContract);

  if (confirmations < 1) throw new Error("Confirmations can't be lower than 1.");

  const deploymentDir = getDefaultDeploymentPath(hre);
  const deploymentExists = await fs.pathExists(path.join(deploymentDir, DEPLOYMENT_JSON_NAME));
  if (!deploymentExists) {
    throw new Error(
      `A deployment for the ${hre.network.name} network was not found.
Ensure the correct network is passed to the --network parameter.`
    );
  }
  const { dogeToken } = await loadDeployment(hre, deploymentDir);

  // TODO: prepare contract factory for implementation and initializer call
  const upgrade = await prepareUpgradeToken(
    hre,
    logicFactory,
    dogeToken.contract.address,
    {
      confirmations,
      ...(maxFeePerGas !== undefined && {
        maxFeePerGas: hre.ethers.utils.parseUnits(maxFeePerGas, "gwei"),
      }),
      ...(maxPriorityFeePerGas !== undefined && {
        maxPriorityFeePerGas: hre.ethers.utils.parseUnits(maxPriorityFeePerGas, "gwei"),
      }),
      ...(tokenGasLimit !== undefined && { logicGasLimit: tokenGasLimit }),
    },
    callArgs
  );

  console.log(
    `Token logic is deployed at address ${upgrade.implementation}.${
      upgrade.initData !== undefined
        ? `
Token migration call data is ${upgrade.initData}`
        : ""
    }`
  );

  // TODO: should we store this output?
  // Alternatively we could make it easy to generate only the encoded call data.
};

async function readCall(callArgs: string): Promise<ContractCall> {
  const callArgsModulePath = path.resolve(process.cwd(), callArgs);

  try {
    const contractCall: unknown = (await import(callArgsModulePath)).default;
    assertContractCall(contractCall);
    return contractCall;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(
      `Importing the module for the migration contract call failed.
Reason: ${error.message}`
    );
  }
}

export const upgradeTaskName = generateTaskName("upgradeToken");

task(upgradeTaskName, "Upgrades doge token.")
  .addParam(
    "newLogicContract",
    "The name of the logic contract used in the upgrade.",
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
    "tokenGasLimit",
    "The maximum amount of gas allowed in token logic deploy tx execution. Autodetected if not set.",
    undefined,
    types.int
  )
  .addOptionalParam(
    "callArgs",
    "File path to a javascript module that exports the name of an ABI" +
      " function and a list of arguments for that function.",
    undefined,
    types.inputFile
  )
  .setAction(upgradeCommand);
