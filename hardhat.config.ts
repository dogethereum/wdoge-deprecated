import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import type { HardhatUserConfig } from "hardhat/types";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "hardhat-prettier";

import "./tasks/deploy";

const config: HardhatUserConfig = {
  solidity: {
    // Latest supported version by hardhat
    // https://hardhat.org/reference/solidity-support.html
    version: "0.8.9",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};

export default config;
