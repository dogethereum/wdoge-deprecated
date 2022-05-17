import chalk from "chalk";
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
  newImplementationContract: string;
  callArgs?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  tokenGasLimit?: number;
  nonce?: number;
}

/**
 * This script always deploys the production token.
 */
const upgradeCommand: ActionType<UpgradeTokenTaskArguments> = async function (
  {
    confirmations,
    newImplementationContract,
    callArgs: callArgsModule,
    tokenGasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
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
  const implementationFactory = await hre.ethers.getContractFactory(newImplementationContract);

  if (confirmations < 1) throw new Error("Confirmations can't be lower than 1.");

  const deploymentDir = getDefaultDeploymentPath(hre);
  const deploymentExists = await fs.pathExists(path.join(deploymentDir, DEPLOYMENT_JSON_NAME));
  if (!deploymentExists) {
    throw new Error(
      `A deployment for the ${hre.network.name} network was not found.
Ensure the correct network is passed to the --network parameter.`
    );
  }
  const { wDoge } = await loadDeployment(hre, deploymentDir);

  const upgrade = await prepareUpgradeToken(
    hre,
    implementationFactory,
    wDoge.contract.address,
    {
      confirmations,
      ...(maxFeePerGas !== undefined && {
        maxFeePerGas: hre.ethers.utils.parseUnits(maxFeePerGas, "gwei"),
      }),
      ...(maxPriorityFeePerGas !== undefined && {
        maxPriorityFeePerGas: hre.ethers.utils.parseUnits(maxPriorityFeePerGas, "gwei"),
      }),
      ...(tokenGasLimit !== undefined && { implementationGasLimit: tokenGasLimit }),
      ...(nonce !== undefined && { nonce }),
    },
    callArgs
  );

  console.log(
    `Token implementation address is ${chalk.green(upgrade.implementation)}${
      upgrade.initData !== undefined
        ? `
Token migration call data is ${chalk.green(upgrade.initData)}`
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
    "newImplementationContract",
    "The name of the implementation contract used in the upgrade.",
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
    "The maximum amount of gas allowed in token implementation deploy tx execution. Autodetected if not set.",
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
  .addOptionalParam(
    "nonce",
    "The first nonce to be used when creating a transaction." +
      " Other transactions will use consecutive numbers to this nonce.",
    undefined,
    types.int
  )
  .setAction(upgradeCommand);
