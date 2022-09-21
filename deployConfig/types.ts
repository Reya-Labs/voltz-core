import { BigNumberish } from "ethers";

// timestamp, and observed value in ray
export type RateOracleDataPoint = [number, BigNumberish];
export interface TokenConfig {
  name: string;
  address: string;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
  daysOfTrustedDataPoints?: number;
  borrow?: boolean;
}
export interface LpMarginCapDefaults {
  eth: number;
  stableCoin: number;
}
export interface RateOracleConfigDefaults {
  rateOracleBufferSize: number; // For mock token oracle or platforms with only a single token
  minSecondsSinceLastUpdate: number; // For mock token oracle or platforms with only a single token
  daysOfTrustedDataPoints?: number; // For mock token oracle or platforms with only a single token
}
export interface AaveConfig {
  aaveLendingPool?: string;
  aaveTokens: TokenConfig[];
}
export interface CompoundConfig {
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
  compoundConfig?: CompoundConfig;
  lidoConfig?: LidoConfig;
  rocketPoolConfig?: RocketPoolConfig;
  skipFactoryDeploy?: boolean;
  factoryOwnedByMultisig?: boolean;
  maxIrsDurationInSeconds: number;
}
export interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}
