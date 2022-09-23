import * as dotenv from "dotenv";
import type { ContractsConfig, ContractsConfigMap } from "./types";
import { kovanConfig } from "./kovan";
import { goerliConfig } from "./goerli";
import { mainnetConfig } from "./mainnet";
import { localhostConfig } from "./localhost";
import { rinkebyConfig } from "./rinkeby";

dotenv.config();

function duplicateExists(arr: string[]) {
  return new Set(arr).size !== arr.length;
}

const config: ContractsConfigMap = {
  kovan: kovanConfig,
  goerli: goerliConfig,
  rinkeby: rinkebyConfig,
  // localhost: mainnetConfig, // Uncomment if testing against a fork of an existing mainnet system
  localhost: localhostConfig,
  mainnet: mainnetConfig,
  // hardhat: kovanConfig, // uncomment if testing against a kovan fork
  // hardhat: { ...mainnetConfig, skipFactoryDeploy: false, }, // uncomment if deploying a new system against a mainnet fork
  hardhat: process.env.FORK_MAINNET
    ? { ...mainnetConfig, skipFactoryDeploy: false }
    : process.env.FORK_KOVAN
    ? kovanConfig
    : localhostConfig,
};

// This function must be used to access config because it performs runtime checks on config consistency
export const getConfig = (_networkName: string): ContractsConfig => {
  if (!config[_networkName]) {
    throw Error(`No deploy config found for network ${_networkName}`);
  }

  const _config = config[_networkName];
  if (
    _config.compoundConfig?.compoundTokens &&
    duplicateExists(_config.compoundConfig?.compoundTokens?.map((t) => t.name))
  ) {
    throw Error(
      `Duplicate token names configured for Compound on network ${_networkName}`
    );
  }

  if (
    _config.aaveConfig?.aaveTokens &&
    duplicateExists(_config.aaveConfig?.aaveTokens?.map((t) => t.name))
  ) {
    throw Error(
      `Duplicate token names configured for Aave on network ${_networkName}`
    );
  }

  return config[_networkName];
};
