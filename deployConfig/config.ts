import * as dotenv from "dotenv";
import type { ContractsConfig, ContractsConfigMap } from "./types";
import { goerliConfig } from "./goerli";
import { mainnetConfig } from "./mainnet";
import { localhostConfig } from "./localhost";
import { arbitrumConfig } from "./arbitrum";
import { arbitrumGoerliConfig } from "./arbitrumGoerli";

dotenv.config();

function duplicateExists(arr: string[]) {
  return new Set(arr).size !== arr.length;
}

const config: ContractsConfigMap = {
  goerli: goerliConfig,
  // localhost: mainnetConfig, // Uncomment if testing against a fork of an existing mainnet system
  localhost: localhostConfig,
  mainnet: mainnetConfig,
  arbitrum: arbitrumConfig,
  arbitrumGoerli: arbitrumGoerliConfig,
  // hardhat: { ...mainnetConfig, skipFactoryDeploy: false, }, // uncomment if deploying a new system against a mainnet fork
  hardhat: process.env.FORK_MAINNET
    ? { ...mainnetConfig, skipFactoryDeploy: false }
    : localhostConfig,
};

// This function must be used to access config because it performs runtime checks on config consistency
export const getConfig = (_networkName: string): ContractsConfig => {
  if (!config[_networkName]) {
    throw Error(`No deploy config found for network ${_networkName}`);
  }

  const _config = config[_networkName];
  const compoundTokens = _config.compoundConfig?.compoundTokens;
  const aaveTokens = _config.compoundConfig?.compoundTokens;

  if (
    compoundTokens &&
    // check for borrow token duplicates
    (duplicateExists(
      compoundTokens?.filter((t) => t.borrow).map((t) => t.name)
    ) ||
      // check for non-borrow token duplicates
      duplicateExists(
        compoundTokens?.filter((t) => !t.borrow).map((t) => t.name)
      ))
  ) {
    throw Error(
      `Duplicate token names configured for Compound on network ${_networkName}`
    );
  }

  if (
    aaveTokens &&
    // check for borrow token duplicates
    (duplicateExists(aaveTokens?.filter((t) => t.borrow).map((t) => t.name)) ||
      // check for non-borrow token duplicates
      duplicateExists(aaveTokens?.filter((t) => !t.borrow).map((t) => t.name)))
  ) {
    throw Error(
      `Duplicate token names configured for Aave on network ${_networkName}`
    );
  }

  return config[_networkName];
};
