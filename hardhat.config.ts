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
import "hardhat-storage-layout";
import { HardhatNetworkUserConfig } from "hardhat/types";
// import "@primitivefi/hardhat-dodoc"; bring back on demand

dotenv.config();

let someTasksNotImported = false;

task(
  "printStorageLayout",
  "Prints the storage layout of all contracts"
).setAction(async (_, hre) => {
  console.log("getting storage layout (this can take some time)...");
  await hre.storageLayout.export();
  console.log("got storage layout");
});
interface TypeScriptError {
  diagnosticText: string;
  diagnosticCodes: number[];
}
// We can't import some tasks unless we've already built the solidity code and generated types with typechain
// Luckily we don't need these tasks, and can ignore them, if types are missing
const loadModuleIfContractsAreBuilt = async (modulePath: string) => {
  try {
    return await import(modulePath);
  } catch (e) {
    // if (typeof e == "object" && e.diagnosticText) {
    //   console.log("has diagnostictext");
    // }
    if (
      typeof e == "object" &&
      e &&
      "diagnosticText" in e &&
      "diagnosticCodes" in e
    ) {
      // console.log("has diagnosticText:", e.diagnoticText);
      let msg = (e as TypeScriptError).diagnosticText;
      if (msg.includes("TS2307") && msg.includes("typechain")) {
        // console.log( `Could not load task from ${modulePath}: ${JSON.stringify(e)}` );
        // Most likely cause of this error is that the contracts have not been built yet. Ignore import to allow build to go ahead!
        if (!someTasksNotImported) {
          someTasksNotImported = true;
          console.log(
            "Some tasks could not be imported because contract types are not present"
          );
        }
      } else {
        console.log(
          `Failure compiling task ${modulePath}: ${JSON.stringify(e)}`
        );
        // throw e;
      }
    } else {
      console.log(
        `Could not load task from ${modulePath}: ${JSON.stringify(e)}`
      );
      throw e;
    }
  }
};

loadModuleIfContractsAreBuilt("./tasks/irsInstances");
loadModuleIfContractsAreBuilt("./tasks/mintTestTokens");
loadModuleIfContractsAreBuilt("./tasks/mintLiquidity");
loadModuleIfContractsAreBuilt("./tasks/updatePositionMargin");
loadModuleIfContractsAreBuilt("./tasks/increaseObservationCardinalityNext");
loadModuleIfContractsAreBuilt("./tasks/advanceTimeAndBlock");
loadModuleIfContractsAreBuilt("./tasks/updateAPYFor15Days");
loadModuleIfContractsAreBuilt("./tasks/rateOracle");
loadModuleIfContractsAreBuilt("./tasks/setParameters");
loadModuleIfContractsAreBuilt("./tasks/setPeriphery");
loadModuleIfContractsAreBuilt("./tasks/decodeTransactionData");
loadModuleIfContractsAreBuilt("./tasks/getHistoricalData");
loadModuleIfContractsAreBuilt("./tasks/getHistoricalApy");
loadModuleIfContractsAreBuilt("./tasks/getRateOracleData");
loadModuleIfContractsAreBuilt("./tasks/checkPositions");
loadModuleIfContractsAreBuilt("./tasks/playground");
loadModuleIfContractsAreBuilt("./tasks/getTradeHistoricalData");
loadModuleIfContractsAreBuilt("./tasks/upgrades");
loadModuleIfContractsAreBuilt("./tasks/liquidatePositions");
loadModuleIfContractsAreBuilt("./tasks/checkInsolvencyAtMaturity");
loadModuleIfContractsAreBuilt("./tasks/migratePeriphery");
loadModuleIfContractsAreBuilt("./tasks/updateMCParams");
loadModuleIfContractsAreBuilt("./tasks/checkPositionSettlement");
loadModuleIfContractsAreBuilt("./tasks/getHistoricalPositionsHealth");
loadModuleIfContractsAreBuilt("./tasks/setLiquidatorRewards");
loadModuleIfContractsAreBuilt("./tasks/setPausability");
loadModuleIfContractsAreBuilt("./tasks/compareGasCost");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

let hardhatNetworkConfig: HardhatNetworkUserConfig = {
  allowUnlimitedContractSize: true,
};

if (!!process.env.FORK_MAINNET) {
  hardhatNetworkConfig = {
    allowUnlimitedContractSize: true,
    saveDeployments: true,
    chainId: 1,
    forking: {
      url: `${process.env.MAINNET_URL}`,
      // blockNumber: 15402000,
    },
  };
} else if (!!process.env.FORK_KOVAN) {
  hardhatNetworkConfig = {
    allowUnlimitedContractSize: true,
    saveDeployments: true,
    forking: {
      url: `${process.env.KOVAN_URL}`,
    },
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",

    settings: {
      optimizer: {
        enabled: true,
        runs: 10, // As high as is possible without blowing contract size limits
      },
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  networks: {
    localhost: {
      live: false,
    },
    hardhat: {
      ...hardhatNetworkConfig,
    },
    mainnet: {
      url: `${process.env.MAINNET_URL}`,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
    },
    // ropsten: {
    //   url: `${process.env.ROPSTEN_URL}`,
    // },
    kovan: {
      url: `${process.env.KOVAN_URL}`,
      // gasPrice: 1,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
    },
    rinkeby: {
      url: `${process.env.RINKEBY_URL}`,
      // gasPrice: 1,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
    },
    goerli: {
      url: `${process.env.GOERLI_URL}`,
      // gasPrice: 1,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
    },
  },
  namedAccounts: {
    deployer: {
      balance: (10 ** 24).toString(),
      default: 0, // here this will by default take the first account as deployer
    },
    multisig: {
      default: 0, // here this will by default take the first account as deployer
      1: "0xb527E950fC7c4F581160768f48b3bfA66a7dE1f0",
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
