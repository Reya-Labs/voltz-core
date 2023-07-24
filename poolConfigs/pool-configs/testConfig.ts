import { gaps } from "./defaultConfig";
import { SinglePoolConfiguration } from "./types";

export const testConfig: SinglePoolConfiguration = {
  rateOracle: "MockRateOracle",
  tickSpacing: 60,
  cacheMaxAgeInSeconds: 21600,
  lookbackWindowInSeconds: 21600,
  feeWad: "3000000000000000",
  liquidatorRewardWad: "50000000000000000",
  vammFeeProtocol: "0",
  isAlpha: false,
  lpMarginCap: "0",
  termStartTimestamp: 0,
  termEndTimestamp: 0,
  marginCalculatorParams: {
    apyUpperMultiplierWad: "2624177575615731712",
    apyLowerMultiplierWad: "264566723394122112",
    sigmaSquaredWad: "2009996524605",
    alphaWad: "2864070730067",
    betaWad: "510867739246715",
    xiUpperWad: "25000000000000000000",
    xiLowerWad: "100000000000000000000",
    tMaxWad: "31536000000000000000000000",
    etaIMWad: "2810036282184202",
    etaLMWad: "1206112129925342",
    ...gaps,
    minMarginToIncentiviseLiquidators: "0",
  },
};
