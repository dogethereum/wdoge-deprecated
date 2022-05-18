import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import type { HardhatUserConfig } from "hardhat/types";
import "@dogethereum/hardhat-upgrades";
import "hardhat-gas-reporter";
import "hardhat-prettier";

import "./tasks/deploy";
import "./tasks/inspectProxy";
import "./tasks/upgrade";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.14",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};

export default config;
