import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-prettier";
// import "@tenderly/hardhat-tenderly";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer";
import "hardhat-deploy";
// import "@primitivefi/hardhat-dodoc"; bring back on demand

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
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 2,
      },
    },
  },
  networks: {
    localhost: {
      live: false,
      saveDeployments: false,
    },
    hardhat: {
      // forking: {
      //   url: "https://eth-mainnet.alchemyapi.io/v2/pNmKK8pTXHVggw2X4XPAOOuL9SllmxdZ",
      //   blockNumber: 13270796,
      // },
      allowUnlimitedContractSize: true,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
    alice: {
      default: 1,
    },
    bob: {
      default: 2,
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
    timeout: 2400000,
  },
};

export default config;
