import { BigNumberish } from "ethers";

// timestamp, and observed value in ray
export type RateOracleDataPoint = [number, BigNumberish];
export interface TokenConfig {
  name: string;
  address: string;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
  // If migrating, get trusted data points from existing rate oracle using hardhat's queryRateOracle task
  trustedDataPoints?: RateOracleDataPoint[];
}

export interface MarginCalculatorParameters {
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

export interface IrsConfig {
  marginEngineLookbackWindowInSeconds: BigNumberish;
  marginEngineCacheMaxAgeInSeconds: BigNumberish;
  marginEngineLiquidatorRewardWad: BigNumberish;
  marginEngineCalculatorParameters: MarginCalculatorParameters;
  vammFeeProtocol: BigNumberish;
  vammFeeWad: BigNumberish;
  rateOracleBufferSize: BigNumberish;
}

export interface ConfigDefaults extends IrsConfig {
  rateOracleBufferSize: number; // For mock token oracle
  rateOracleMinSecondsSinceLastUpdate: number; // For mock token oracle
}
export interface ContractsConfig {
  aaveLendingPool?: string;
  maxIrsDurationInSeconds: number;
  configDefaults: ConfigDefaults;
  aaveTokens?: TokenConfig[];
  compoundTokens?: TokenConfig[];
}
export interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}
