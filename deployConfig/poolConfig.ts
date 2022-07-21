import { BigNumberish } from "ethers";
import { toBn } from "../test/helpers/toBn";

export interface poolConfig {
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

  // Fraction of fee protocol (wad)
  vammFeeProtocolWad: BigNumberish;

  // alpha state
  isAlpha: boolean;

  // Scaled margin cap
  lpMarginCap: BigNumberish;

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
  };
}

export const poolConfigs: { [name: string]: poolConfig } = {
  aUSDC: {
    rateOracle: "AaveRateOracle_USDC",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 259200,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_500_000, 6),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2000000000000000000",
      apyLowerMultiplierWad: "100000000000000000",
      sigmaSquaredWad: "100000000000000",
      alphaWad: "200000000000000000",
      betaWad: "200000000000000000",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      devMulLeftUnwindLMWad: "3000000000000000000",
      devMulRightUnwindLMWad: "3000000000000000000",
      devMulLeftUnwindIMWad: "6000000000000000000",
      devMulRightUnwindIMWad: "6000000000000000000",
      fixedRateDeviationMinLeftUnwindLMWad: "2000000000000000000",
      fixedRateDeviationMinRightUnwindLMWad: "2000000000000000000",
      fixedRateDeviationMinLeftUnwindIMWad: "4000000000000000000",
      fixedRateDeviationMinRightUnwindIMWad: "10000000000000000000",
      gammaWad: "5000000000000000000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  aDAI: {
    rateOracle: "AaveRateOracle_DAI",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 21600,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_500_000, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2000000000000000000",
      apyLowerMultiplierWad: "100000000000000000",
      sigmaSquaredWad: "100000000000000",
      alphaWad: "200000000000000000",
      betaWad: "200000000000000000",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      devMulLeftUnwindLMWad: "3000000000000000000",
      devMulRightUnwindLMWad: "3000000000000000000",
      devMulLeftUnwindIMWad: "6000000000000000000",
      devMulRightUnwindIMWad: "6000000000000000000",
      fixedRateDeviationMinLeftUnwindLMWad: "2000000000000000000",
      fixedRateDeviationMinRightUnwindLMWad: "2000000000000000000",
      fixedRateDeviationMinLeftUnwindIMWad: "4000000000000000000",
      fixedRateDeviationMinRightUnwindIMWad: "10000000000000000000",
      gammaWad: "5000000000000000000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  cDAI: {
    rateOracle: "CompoundRateOracle_cDAI",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 259200,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_500_000, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2000000000000000000",
      apyLowerMultiplierWad: "100000000000000000",
      sigmaSquaredWad: "100000000000000",
      alphaWad: "200000000000000000",
      betaWad: "200000000000000000",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      devMulLeftUnwindLMWad: "3000000000000000000",
      devMulRightUnwindLMWad: "3000000000000000000",
      devMulLeftUnwindIMWad: "6000000000000000000",
      devMulRightUnwindIMWad: "6000000000000000000",
      fixedRateDeviationMinLeftUnwindLMWad: "2000000000000000000",
      fixedRateDeviationMinRightUnwindLMWad: "2000000000000000000",
      fixedRateDeviationMinLeftUnwindIMWad: "4000000000000000000",
      fixedRateDeviationMinRightUnwindIMWad: "10000000000000000000",
      gammaWad: "5000000000000000000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },
};
