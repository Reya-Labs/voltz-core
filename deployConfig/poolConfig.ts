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
      apyUpperMultiplierWad: "",
      apyLowerMultiplierWad: "",
      sigmaSquaredWad: "",
      alphaWad: "",
      betaWad: "",
      xiUpperWad: "",
      xiLowerWad: "",
      tMaxWad: "",
      devMulLeftUnwindLMWad: "",
      devMulRightUnwindLMWad: "",
      devMulLeftUnwindIMWad: "",
      devMulRightUnwindIMWad: "",
      fixedRateDeviationMinLeftUnwindLMWad: "",
      fixedRateDeviationMinRightUnwindLMWad: "",
      fixedRateDeviationMinLeftUnwindIMWad: "",
      fixedRateDeviationMinRightUnwindIMWad: "",
      gammaWad: "",
      minMarginToIncentiviseLiquidators: "",
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
      apyUpperMultiplierWad: "",
      apyLowerMultiplierWad: "",
      sigmaSquaredWad: "",
      alphaWad: "",
      betaWad: "",
      xiUpperWad: "",
      xiLowerWad: "",
      tMaxWad: "",
      devMulLeftUnwindLMWad: "",
      devMulRightUnwindLMWad: "",
      devMulLeftUnwindIMWad: "",
      devMulRightUnwindIMWad: "",
      fixedRateDeviationMinLeftUnwindLMWad: "",
      fixedRateDeviationMinRightUnwindLMWad: "",
      fixedRateDeviationMinLeftUnwindIMWad: "",
      fixedRateDeviationMinRightUnwindIMWad: "",
      gammaWad: "",
      minMarginToIncentiviseLiquidators: "",
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
      apyUpperMultiplierWad: "",
      apyLowerMultiplierWad: "",
      sigmaSquaredWad: "",
      alphaWad: "",
      betaWad: "",
      xiUpperWad: "",
      xiLowerWad: "",
      tMaxWad: "",
      devMulLeftUnwindLMWad: "",
      devMulRightUnwindLMWad: "",
      devMulLeftUnwindIMWad: "",
      devMulRightUnwindIMWad: "",
      fixedRateDeviationMinLeftUnwindLMWad: "",
      fixedRateDeviationMinRightUnwindLMWad: "",
      fixedRateDeviationMinLeftUnwindIMWad: "",
      fixedRateDeviationMinRightUnwindIMWad: "",
      gammaWad: "",
      minMarginToIncentiviseLiquidators: "",
    },
  },
};
