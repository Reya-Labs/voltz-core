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
  daysOfTrustedDataPoints?: number;
}
export interface LpMarginCapDefaults {
  eth: number;
  stableCoin: number;
}
export interface RateOracleConfigDefaults {
  rateOracleBufferSize: number; // For mock token oracle or platforms with only a single token
  minSecondsSinceLastUpdate: number; // For mock token oracle or platforms with only a single token
  trustedDataPoints: RateOracleDataPoint[]; // For mock token oracle or platforms with only a single token
}
export interface AaveConfig {
  aaveLendingPool?: string;
  aaveTokens: TokenConfig[];
}
export interface AaveBorrowConfig {
  aaveLendingPool?: string;
  aaveTokens: TokenConfig[];
}
export interface CompoundConfig {
  compoundTokens: TokenConfig[];
}

export interface CompoundBorrowConfig {
  compoundTokens: TokenConfig[];
}

export interface LidoConfig {
  lidoStETH?: string;
  lidoOracle?: string;
  defaults: RateOracleConfigDefaults;
}
export interface RocketPoolConfig {
  rocketPoolRocketToken?: string;
  rocketNetworkBalances?: string;
  defaults: RateOracleConfigDefaults;
}
export interface ContractsConfig {
  weth?: string;
  aaveConfig?: AaveConfig;
  aaveBorrowConfig?: AaveBorrowConfig;
  compoundConfig?: CompoundConfig;
  compoundBorrowConfig?: CompoundBorrowConfig;
  lidoConfig?: LidoConfig;
  rocketPoolConfig?: RocketPoolConfig;
  skipFactoryDeploy?: boolean;
  factoryOwnedByMultisig?: boolean;
  maxIrsDurationInSeconds: number;
}
export interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}
