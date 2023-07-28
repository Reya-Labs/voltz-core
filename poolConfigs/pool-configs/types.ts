import { BigNumberish } from "ethers";

export type SinglePoolConfiguration = {
  // The name or address of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT')
  rateOracle: string;

  // Tick spacing of vAMM (NOT wad)
  tickSpacing: number;

  // Historical apy refresh period (NOT wad)
  cacheMaxAgeInSeconds: number;

  // Lookback window in seconds (NOT wad)
  lookbackWindowInSeconds: number;

  // Percentage of LP fees (wad)
  feeWad: BigNumberish;

  // Percentage of liquidator reward (wad)
  liquidatorRewardWad: BigNumberish;

  // Denominator for fee protocol
  vammFeeProtocol: number;

  // alpha state
  isAlpha: boolean;

  // Scaled margin cap
  lpMarginCap: BigNumberish;

  // Term start timestamp
  termStartTimestamp: number;

  // Term end timestamp
  termEndTimestamp: number;

  // Starting tick
  initTick: number;

  // Trading halted buffer in seconds
  maturityBuffer: number;

  // Margin Calculator parameters
  marginCalculatorParams: {
    apyUpperMultiplierWad: BigNumberish;
    apyLowerMultiplierWad: BigNumberish;
    sigmaSquaredWad: BigNumberish;
    alphaWad: BigNumberish;
    betaWad: BigNumberish;
    xiUpperWad: BigNumberish;
    xiLowerWad: BigNumberish;
    tMaxWad: BigNumberish;
    etaIMWad: BigNumberish;
    etaLMWad: BigNumberish;
    gap1: BigNumberish;
    gap2: BigNumberish;
    gap3: BigNumberish;
    gap4: BigNumberish;
    gap5: BigNumberish;
    gap6: BigNumberish;
    gap7: BigNumberish;
    minMarginToIncentiviseLiquidators: BigNumberish;
  };
};

export type NetworkPoolConfigurations = {
  [name: string]: SinglePoolConfiguration;
};

export type PoolConfigurations = {
  [name: string]: NetworkPoolConfigurations;
};
