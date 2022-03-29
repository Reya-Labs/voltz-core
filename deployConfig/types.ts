import { BigNumberish } from "ethers";

export interface TokenConfig {
  name: string;
  address: string;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
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
  rateOracleBufferSize: number;
  rateOracleMinSecondsSinceLastUpdate: number;
}
export interface ContractsConfig {
  aaveLendingPool?: string;
  maxIrsDurationInSeconds: number; // TODO: make sure that the oracle buffer will last this long
  configDefaults: ConfigDefaults;
  aaveTokens?: TokenConfig[];
}
export interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}
