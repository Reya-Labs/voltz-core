import { BigNumberish } from "ethers";

// timestamp, and observed value in ray
export type RateOracleDataPoint = [number, BigNumberish];
export interface TokenConfig {
  name: string;
  address: string;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
  // If migrating, get trusted data points from either:
  // - an existing rate oracle, using hardhat's queryRateOracle task
  // - the source of the data, using hardhat's getHistoricalData task
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

export interface IrsConfigDefaults {
  marginEngineLookbackWindowInSeconds: BigNumberish;
  marginEngineCacheMaxAgeInSeconds: BigNumberish;
  marginEngineLiquidatorRewardWad: BigNumberish;
  marginEngineCalculatorParameters: MarginCalculatorParameters;
  vammFeeProtocol: BigNumberish;
  vammFeeWad: BigNumberish;
  maxIrsDurationInSeconds: number;
}
export interface RateOracleConfigDefaults {
  rateOracleBufferSize: BigNumberish; // For mock token oracle or platforms with only a single token
  rateOracleMinSecondsSinceLastUpdate: number; // For mock token oracle or platforms with only a single token
  trustedDataPoints: RateOracleDataPoint[]; // For mock token oracle or platforms with only a single token
}
export interface AaveConfig {
  aaveLendingPool?: string;
  aaveTokens: TokenConfig[];
  defaults: RateOracleConfigDefaults;
}

export interface CompoundConfig {
  compoundTokens: TokenConfig[];
  defaults: RateOracleConfigDefaults;
}

export interface LidoConfig {
  lidoStETH?: string;
  defaults: RateOracleConfigDefaults;
}
export interface RocketPoolConfig {
  rocketPoolRocketToken?: string;
  defaults: RateOracleConfigDefaults;
}
export interface ContractsConfig {
  weth?: string;
  irsConfig: IrsConfigDefaults;
  aaveConfig?: AaveConfig;
  compoundConfig?: CompoundConfig;
  lidoConfig?: LidoConfig;
  rocketPoolConfig?: RocketPoolConfig;
  skipFactoryDeploy?: boolean;
  factoryOwnedByMultisig?: boolean;
}
export interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}
