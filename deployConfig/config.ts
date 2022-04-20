import type { ConfigDefaults, ContractsConfigMap, TokenConfig } from "./types";
// import { network } from "hardhat"; // Not importable from tasks
import { toBn } from "../test/helpers/toBn";

function duplicateExists(arr: string[]) {
  return new Set(arr).size !== arr.length;
}

const marginCalculatorDefaults1 = {
  apyUpperMultiplierWad: toBn(1.5),
  apyLowerMultiplierWad: toBn(0.7),
  sigmaSquaredWad: toBn(0.5),
  alphaWad: toBn(0.1),
  betaWad: toBn(1),
  xiUpperWad: toBn(2),
  xiLowerWad: toBn(1.5),
  tMaxWad: toBn(31536000), // one year
  devMulLeftUnwindLMWad: toBn(0.5),
  devMulRightUnwindLMWad: toBn(0.5),
  devMulLeftUnwindIMWad: toBn(1.5),
  devMulRightUnwindIMWad: toBn(1.5),
  fixedRateDeviationMinLeftUnwindLMWad: toBn(0.1),
  fixedRateDeviationMinRightUnwindLMWad: toBn(0.1),
  fixedRateDeviationMinLeftUnwindIMWad: toBn(0.3),
  fixedRateDeviationMinRightUnwindIMWad: toBn(0.3),
  gammaWad: toBn(1),
  minMarginToIncentiviseLiquidators: 0,
};

const kovanConfigDefaults: ConfigDefaults = {
  marginEngineLookbackWindowInSeconds: 60 * 60 * 6, // 6 hours
  // marginEngineLookbackWindowInSeconds: 1209600, // 2 weeks
  marginEngineCacheMaxAgeInSeconds: 6 * 60 * 60, // 6 hours
  marginEngineLiquidatorRewardWad: toBn(0.1),
  marginEngineCalculatorParameters: marginCalculatorDefaults1,
  vammFeeProtocol: 10,
  vammFeeWad: toBn(0.009), // 0.9%, for 30 day pool
  rateOracleBufferSize: 100,
  rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
};

const localhostConfigDefaults = {
  ...kovanConfigDefaults,
  marginEngineLookbackWindowInSeconds: 60 * 60, // 1 hour
  marginEngineCacheMaxAgeInSeconds: 60 * 60, // 1 hour
  rateOracleMinSecondsSinceLastUpdate: 60 * 60, // 1 hour
  rateOracleBufferSize: 1000,
};

const config: ContractsConfigMap = {
  kovan: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
    // maxIrsDurationInSeconds: 60 * 60 * 24 * 62, // 32 days. Do not increase without checking that rate oracle buffers are large enough
    configDefaults: kovanConfigDefaults,

    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      {
        name: "USDT",
        address: "0x13512979ADE267AB5100878E2e0f485B568328a4",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "USDC",
        address: "0xe22da380ee6B445bb8273C81944ADEB6E8450422",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
  localhost: {
    maxIrsDurationInSeconds: 60 * 60 * 24 * 30, // 30 days. Do not increase without checking that rate oracle buffers are large enough
    configDefaults: localhostConfigDefaults,
  },
  hardhat: {
    maxIrsDurationInSeconds: 60 * 60 * 24 * 30, // 30 days. Do not increase without checking that rate oracle buffers are large enough
    configDefaults: localhostConfigDefaults,
  },
};

export const getAaveLendingPoolAddress = (
  _networkName: string
): string | undefined => {
  // const networkName = _networkName || network.name;
  return config[_networkName]
    ? config[_networkName].aaveLendingPool
    : undefined;
};

export const getMaxDurationOfIrsInSeconds = (_networkName: string): number => {
  // const networkName = _networkName || network.name;
  return config[_networkName].maxIrsDurationInSeconds;
};

export const getAaveTokens = (
  _networkName: string
): TokenConfig[] | undefined => {
  // const networkName = _networkName || network.name;

  const aaveTokens = config[_networkName]
    ? config[_networkName].aaveTokens
    : undefined;
  // Check for duplicate token names. These must be unique because they are used to name the deployed contracts
  if (aaveTokens && duplicateExists(aaveTokens?.map((t) => t.name))) {
    throw Error(`Duplicate token names configured for network ${_networkName}`);
  }
  return aaveTokens;
};

export const getConfigDefaults = (_networkName: string): ConfigDefaults => {
  if (!config[_networkName] || !config[_networkName].configDefaults) {
    throw new Error(
      `No default deployment config set for network ${_networkName}`
    );
  }
  // const networkName = _networkName || network.name;
  return config[_networkName].configDefaults;
};
