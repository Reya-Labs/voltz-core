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
}

export const poolConfigs: { [name: string]: poolConfig } = {
  borrow_aETH_v1: {
    rateOracle: "AaveBorrowRateOracle_WETH",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 12 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: toBn("0"),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2020995081059354112",
      apyLowerMultiplierWad: "130795812543698432",
      sigmaSquaredWad: "4753455391293",
      alphaWad: "326444791607040",
      betaWad: "36024629947560684",
      xiUpperWad: "19000000000000000000",
      xiLowerWad: "35000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "2131103986271450",
      etaLMWad: "1080162721237868",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  aETH_v1: {
    rateOracle: "AaveRateOracle_WETH",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 12 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: toBn("0"),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2020995081059354112",
      apyLowerMultiplierWad: "130795812543698432",
      sigmaSquaredWad: "4753455391293",
      alphaWad: "326444791607040",
      betaWad: "36024629947560684",
      xiUpperWad: "19000000000000000000",
      xiLowerWad: "35000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "2131103986271450",
      etaLMWad: "1080162721237868",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  borrow_aUSDC_v1: {
    rateOracle: "AaveBorrowRateOracle_USDC",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 11 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0", // note USDC uses 6 decimals
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1335271526375451392",
      apyLowerMultiplierWad: "509107441213905856",
      sigmaSquaredWad: "1365227274285",
      alphaWad: "1949152506199",
      betaWad: "37796318750091",
      xiUpperWad: "49000000000000000000",
      xiLowerWad: "86000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "2913059813811162",
      etaLMWad: "887007499577303",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  borrow_cUSDT_v1: {
    rateOracle: "CompoundBorrowRateOracle_cUSDT",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 10 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0", // note USDT uses 6 decimals
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1349916020965325824",
      apyLowerMultiplierWad: "532711169308407232",
      sigmaSquaredWad: "2725848167335",
      alphaWad: "166692599648233",
      betaWad: "6758584070518913",
      xiUpperWad: "25000000000000000000",
      xiLowerWad: "70000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "3736643999597247",
      etaLMWad: "522548241306638",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  aUSDC_v2: {
    rateOracle: "AaveRateOracle_USDC",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 13 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0", // note USDC uses 6 decimals
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2618590114264089088",
      apyLowerMultiplierWad: "270272875336004576",
      sigmaSquaredWad: "2703734006311",
      alphaWad: "119408629242075",
      betaWad: "10143562308597870",
      xiUpperWad: "19000000000000000000",
      xiLowerWad: "55000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "3148024301386302",
      etaLMWad: "763078524801359",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  aDAI_v2: {
    rateOracle: "AaveRateOracle_DAI",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 12 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0",
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
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  cDAI_v2: {
    rateOracle: "CompoundRateOracle_cDAI",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 15 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0",
    marginCalculatorParams: {
      apyUpperMultiplierWad: "3095318159049937408",
      apyLowerMultiplierWad: "56482622244898504",
      sigmaSquaredWad: "2240203247686",
      alphaWad: "39928080040940",
      betaWad: "2857717498574416",
      xiUpperWad: "28000000000000000000",
      xiLowerWad: "55000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "1435435085885949",
      etaLMWad: "552984013875381",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  rETH_v1: {
    rateOracle: "RocketPoolRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 10 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0",
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1330403972580154880",
      apyLowerMultiplierWad: "695323126856589696",
      sigmaSquaredWad: "4911361273220",
      alphaWad: "884125694186116",
      betaWad: "29639680817469288",
      xiUpperWad: "19000000000000000000",
      xiLowerWad: "50000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "8339679487565499",
      etaLMWad: "2235643406201386",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  stETH_v1: {
    rateOracle: "LidoRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 12 * 24 * 60 * 60,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0",
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1227061120286234880",
      apyLowerMultiplierWad: "741946561695063680",
      sigmaSquaredWad: "261925496417",
      alphaWad: "102986849448533",
      betaWad: "3065026034617912",
      xiUpperWad: "24000000000000000000",
      xiLowerWad: "68000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: "8936275037363058",
      etaLMWad: "1682503506608616",
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  default: {
    rateOracle: "MockRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 21600,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: false,
    lpMarginCap: "0",
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
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),
      minMarginToIncentiviseLiquidators: "0",
    },
  },
};
