import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-prettier";
import "hardhat-gas-reporter";
import "@tenderly/hardhat-tenderly";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer";
import "@primitivefi/hardhat-dodoc";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/pNmKK8pTXHVggw2X4XPAOOuL9SllmxdZ",
        blockNumber: 13270796,
      },
      // accounts: {
      //   accountsBalance: "100000000000000000000000", // 100000 ETH
      //   count: 5,
      // },
      allowUnlimitedContractSize: true,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    outputFile: process.env.REPORT_GAS_TO_FILE,
    noColors: !!process.env.REPORT_GAS_TO_FILE,
    enabled: !!(process.env.REPORT_GAS && process.env.REPORT_GAS != "false"),
  },
  mocha: {
    timeout: 20000,
  },
};

export default config;
