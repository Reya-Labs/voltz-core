import { toBn } from "../test/helpers/toBn";

export const gaps = {
  gap1: toBn("0"),
  gap2: toBn("0"),
  gap3: toBn("0"),
  gap4: toBn("0"),
  gap5: toBn("0"),
  gap6: toBn("0"),
  gap7: toBn("0"),
};

export const defaultConfig = {
  tickSpacing: 60,
  cacheMaxAgeInSeconds: 21600,
  lookbackWindowInSeconds: 11 * 24 * 60 * 60,
  feeWad: "1000000000000000",
  liquidatorRewardWad: "50000000000000000",
  vammFeeProtocolWad: "0",
  isAlpha: false,
  lpMarginCap: "0",
  marginCalculatorParams: {
    apyUpperMultiplierWad: "1961509192811945728",
    apyLowerMultiplierWad: "839562149274473984",
    sigmaSquaredWad: "2502012155004",
    alphaWad: "108853457951948",
    betaWad: "9190145037034650",
    xiUpperWad: "20000000000000000000",
    xiLowerWad: "54000000000000000000",
    tMaxWad: "31536000000000000000000000",
    etaIMWad: "9979206586261602",
    etaLMWad: "3975809974130872",
    ...gaps,
    minMarginToIncentiviseLiquidators: "0",
  },
};
