import { BigNumberish } from "ethers";
import { network } from "hardhat";
import { toBn } from "../test/helpers/toBn";

// Manage addresses for third-party contracts
interface TokenConfig {
  name: string;
  address: string;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
}

interface MarginCalculatorParameters {
  apyUpperMultiplierWad: BigNumberish;
  apyLowerMultiplierWad: BigNumberish;
  sigmaSquaredWad: BigNumberish;
  alphaWad: BigNumberish;
  betaWad: BigNumberish;
  xiUpperWad: BigNumberish;
  xiLowerWad: BigNumberish;
  tMaxWad: BigNumberish;
  devMulLeftUnwindLMWad: BigNumberish;
  devMulRightUnwindLMWad: BigNumberish;
  devMulLeftUnwindIMWad: BigNumberish;
  devMulRightUnwindIMWad: BigNumberish;
  fixedRateDeviationMinLeftUnwindLMWad: BigNumberish;
  fixedRateDeviationMinRightUnwindLMWad: BigNumberish;
  fixedRateDeviationMinLeftUnwindIMWad: BigNumberish;
  fixedRateDeviationMinRightUnwindIMWad: BigNumberish;
  gammaWad: BigNumberish;
  minMarginToIncentiviseLiquidators: BigNumberish;
}

interface IrsConfig {
  marginEngineSecondsAgo: BigNumberish;
  marginEngineCacheMaxAgeInSeconds: BigNumberish;
  marginEngineLiquidatorRewardWad: BigNumberish;
  marginEngineCalculatorParameters: MarginCalculatorParameters;
  vammFeeProtocol: BigNumberish;
  vammFeeWad: BigNumberish;
  rateOracleBufferSize: BigNumberish;
}

interface ConfigDefaults extends IrsConfig {
  rateOracleBufferSize: number;
  rateOracleMinSecondsSinceLastUpdate: number;
}
interface ContractsConfig {
  aaveLendingPool: string;
  aaveTokens: TokenConfig[];
}
interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}

function duplicateExists(arr: string[]) {
  return new Set(arr).size !== arr.length;
}

const marginCalculatorDefaults1 = {
  apyUpperMultiplierWad: toBn(1.5),
  apyLowerMultiplierWad: toBn(0.7),
  sigmaSquaredWad: toBn(0.01),
  alphaWad: toBn(0.04),
  betaWad: toBn(1),
  xiUpperWad: toBn(2),
  xiLowerWad: toBn(1.5),
  tMaxWad: toBn(31536000), // one year
  devMulLeftUnwindLMWad: toBn(0.5),
  devMulRightUnwindLMWad: toBn(0.5),
  devMulLeftUnwindIMWad: toBn(0.8),
  devMulRightUnwindIMWad: toBn(0.8),
  fixedRateDeviationMinLeftUnwindLMWad: toBn(0.1),
  fixedRateDeviationMinRightUnwindLMWad: toBn(0.1),
  fixedRateDeviationMinLeftUnwindIMWad: toBn(0.3),
  fixedRateDeviationMinRightUnwindIMWad: toBn(0.3),
  gammaWad: toBn(1),
  minMarginToIncentiviseLiquidators: 0,
};

export const configDefaults: ConfigDefaults = {
  marginEngineSecondsAgo: 1209600, // 2 weeks
  marginEngineCacheMaxAgeInSeconds: 6 * 60 * 60, // 6 hours
  marginEngineLiquidatorRewardWad: toBn(0.5),
  marginEngineCalculatorParameters: marginCalculatorDefaults1,
  vammFeeProtocol: 10,
  vammFeeWad: toBn(0.001), // 0.1%
  rateOracleBufferSize: 100,
  rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
};

const config: ContractsConfigMap = {
  kovan: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",

    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      {
        name: "USDT",
        address: "0x13512979ADE267AB5100878E2e0f485B568328a4",
        rateOracleBufferSize: 50,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
};

export const getAaveLendingPoolAddress = (
  _networkName?: string
): string | null => {
  const networkName = _networkName || network.name;
  return config[networkName] ? config[networkName].aaveLendingPool : null;
};

export const getAaveTokens = (_networkName?: string): TokenConfig[] | null => {
  const networkName = _networkName || network.name;

  const aaveTokens = config[networkName]
    ? config[networkName].aaveTokens
    : null;
  // Check for duplicate token names. These must be unique because they are used to name the deployed contracts
  if (aaveTokens && duplicateExists(aaveTokens?.map((t) => t.name))) {
    throw Error(`Duplicate token names configured for network ${network.name}`);
  }
  return aaveTokens;
};
