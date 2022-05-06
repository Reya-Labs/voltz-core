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

// We can't import some tasks unless we've already built the solidity code and generated types with typechain
// Luckily we don't need these tasks, and can ignore them, if types are missing
const loadModuleIgnoreErrors = async (modulePath: string) => {
  try {
    return await import(modulePath);
  } catch (e) {
    // Ignore
    // console.log(`Could not load task from ${modulePath}: ${JSON.stringify(e)}`);
  }
};

loadModuleIgnoreErrors("./tasks/createIrsInstance");
loadModuleIgnoreErrors("./tasks/listIrsInstances");
loadModuleIgnoreErrors("./tasks/mintTestTokens");
loadModuleIgnoreErrors("./tasks/mintLiquidity");
loadModuleIgnoreErrors("./tasks/updatePositionMargin");
loadModuleIgnoreErrors("./tasks/increaseObservationCardinalityNext");
loadModuleIgnoreErrors("./tasks/advanceTimeAndBlock");
loadModuleIgnoreErrors("./tasks/updateAPYFor15Days");
loadModuleIgnoreErrors("./tasks/rateOracle");
loadModuleIgnoreErrors("./tasks/setParameters");
loadModuleIgnoreErrors("./tasks/setPeriphery");

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
    version: "0.8.9",

    settings: {
      optimizer: {
        enabled: true,
        runs: 60, // As high as is possible without blowing contract size limits
      },
    },
  },
  networks: {
    localhost: {
      live: false,
    },
    hardhat: {
      // forking: {
      //   url: `${process.env.KOVAN_URL}`,
      //   blockNumber: 31458273,
      // },
      allowUnlimitedContractSize: true,
    },
    mainnet: {
      url: `${process.env.MAINNET_URL}`,
    },
    // ropsten: {
    //   url: `${process.env.ROPSTEN_URL}`,
    // },
    // rinkeby: {
    //   url: `${process.env.RINKEBY_URL}`,
    // },
    // goerli: {
    //   url: `${process.env.GOERLI_URL}`,
    // },
    kovan: {
      url: `${process.env.KOVAN_URL}`,
      // gasPrice: 1,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
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
    currency: "USD",
    gasPrice: 120,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  mocha: {
    timeout: 2400000,
  },
  contractSizer: {
    strict: true,
    except: [":Test"],
  },
};

export default config;
