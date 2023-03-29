import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-prettier";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-storage-layout";
import { HardhatNetworkUserConfig } from "hardhat/types";

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

// PCV transactions
loadModuleIfContractsAreBuilt("./tasks/pcv/pcv-mints");
loadModuleIfContractsAreBuilt("./tasks/pcv/pcv-settlePositions");

// Localhost time manipulation support
loadModuleIfContractsAreBuilt("./tasks/advanceTimeAndBlock");

// Pool initial leverages
loadModuleIfContractsAreBuilt("./tasks/getPoolLeverages");

// Data extractions
loadModuleIfContractsAreBuilt("./tasks/getHistoricalData");
loadModuleIfContractsAreBuilt("./tasks/getHistoricalApy");
loadModuleIfContractsAreBuilt("./tasks/getSlippageData");

// Position support
loadModuleIfContractsAreBuilt("./tasks/checkPositions");
loadModuleIfContractsAreBuilt("./tasks/estimateCashflow");
loadModuleIfContractsAreBuilt("./tasks/calculatePositionSettlement");
loadModuleIfContractsAreBuilt("./tasks/liquidatePositions");

// Pool support
loadModuleIfContractsAreBuilt("./tasks/irsInstances");
loadModuleIfContractsAreBuilt("./tasks/updateMarginEngines");
loadModuleIfContractsAreBuilt("./tasks/getLiquidityDistribution");

// System support
loadModuleIfContractsAreBuilt("./tasks/deployUpdatedImplementations");
loadModuleIfContractsAreBuilt("./tasks/hotSwapRateOracle");
loadModuleIfContractsAreBuilt("./tasks/setPausability");
loadModuleIfContractsAreBuilt("./tasks/setPeriphery");
loadModuleIfContractsAreBuilt("./tasks/upgrades");

// Rate oracle support
loadModuleIfContractsAreBuilt("./tasks/getRateOracleData");
loadModuleIfContractsAreBuilt("./tasks/queryRateOracleEntry");
loadModuleIfContractsAreBuilt("./tasks/transferRateOracleOwnership");
loadModuleIfContractsAreBuilt("./tasks/writeRateOracleEntries");
loadModuleIfContractsAreBuilt("./tasks/increaseObservationCardinalityNext");

// Community deployer script
loadModuleIfContractsAreBuilt(
  "./scripts/produceCommunityDeployerJSON/produceCommunityDeployerJSON"
);

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
    live: false,
    forking: {
      url: `${process.env.MAINNET_URL}`,
      // blockNumber: 15919000,
    },
  };
}

// steps to hack hardhat such that Arbitrum forking works:
// 1. (install custom patch) yarn add -D hardhat@npm:@gzeoneth/hardhat@2.10.1-gzeon-c8fe47dd4
// 2. Go to the package (./node_modules/hardhat/internal/hardhat-network/provider/fork/ForkBlockchain.js:24)
// and change to ``this._forkIgnoreUnknownTxType = true;``

// please update if you find smarter ways :)

if (!!process.env.FORK_ARBITRUM) {
  hardhatNetworkConfig = {
    allowUnlimitedContractSize: true,
    saveDeployments: true,
    chainId: 42161,
    live: false,
    forking: {
      url: `${process.env.ARBITRUM_URL}`,
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
    goerli: {
      url: `${process.env.GOERLI_URL}`,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
    },
    arbitrum: {
      url: `${process.env.ARBITRUM_URL}`,
      accounts: {
        mnemonic: `${process.env.SECRET_SEED_PHRASE}`,
      },
    },
    arbitrumGoerli: {
      url: `${process.env.ARBITRUM_GOERLI_URL}`,
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
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      arbitrum: process.env.ARBISCAN_API_KEY || "",
      arbitrumGoerli: process.env.ARBISCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "arbitrumGoerli",
        chainId: 421613,
        urls: {
          apiURL: "https://api-goerli.arbiscan.io/api",
          browserURL: "https://goerli.arbiscan.io",
        },
      },
    ],
  },
};

export default config;
