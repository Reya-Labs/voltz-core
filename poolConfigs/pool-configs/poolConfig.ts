import { defaultConfig, gaps } from "./defaultConfig";
import {
  SinglePoolConfiguration,
  NetworkPoolConfigurations,
  PoolConfigurations,
} from "./types";

const poolConfigs: PoolConfigurations = {
  mainnet: {
    aUSDC_v15: {
      rateOracle: "AaveRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1187385705462526208",
        apyLowerMultiplierWad: "562542242130054912",
        sigmaSquaredWad: "31094071557165",
        alphaWad: "644749085245879",
        betaWad: "54805081960637280",
        xiUpperWad: "23000000000000000000",
        xiLowerWad: "48000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "3195808002218788",
        etaLMWad: "2371082342977234",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -10784,
    },

    borrow_aUSDC_v4: {
      rateOracle: "AaveBorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 12 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1114135216988942464",
        apyLowerMultiplierWad: "875900881810274944",
        sigmaSquaredWad: "1049725094039",
        alphaWad: "770411150365860",
        betaWad: "14045375270969446",
        xiUpperWad: "22000000000000000000",
        xiLowerWad: "68000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4877671313963962",
        etaLMWad: "2539120751534275",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -12672,
    },

    borrow_aUSDC_v5: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1684152000,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1246328792246992896",
        apyLowerMultiplierWad: "571288518738991680",
        sigmaSquaredWad: "4421123499352",
        alphaWad: "413946676242590",
        betaWad: "27210198230929540",
        xiUpperWad: "30000000000000000000",
        xiLowerWad: "56000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "3887858919780962",
        etaLMWad: "1724214308951546",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -12938,
    },

    borrow_aUSDC_v6: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1684083600,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1246328792246992896",
        apyLowerMultiplierWad: "571288518738991680",
        sigmaSquaredWad: "4421123499352",
        alphaWad: "413946676242590",
        betaWad: "27210198230929540",
        xiUpperWad: "30000000000000000000",
        xiLowerWad: "56000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "3887858919780962",
        etaLMWad: "1724214308951546",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -11909,
    },

    // aDAI pools

    // cDAI pools

    // stETH pools
    stETH_v4: {
      rateOracle: "LidoRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 10 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1932191388375068416",
        apyLowerMultiplierWad: "620480437067180416",
        sigmaSquaredWad: "34467142364137",
        alphaWad: "2658042483481336",
        betaWad: "57542006430427368",
        xiUpperWad: "26000000000000000000",
        xiLowerWad: "58000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4032632858450272",
        etaLMWad: "2032632858450272",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -16187,
    },

    // rETH pools
    rETH_v4: {
      rateOracle: "RocketPoolRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1245990071488751872",
        apyLowerMultiplierWad: "618935803916078976",
        sigmaSquaredWad: "46939481287806",
        alphaWad: "2108168349442909",
        betaWad: "45374753740437552",
        xiUpperWad: "26000000000000000000",
        xiLowerWad: "56000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4304838495072096",
        etaLMWad: "2105254798503294",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -16660,
    },

    // aETH pools

    // borrow aETH pools
    borrow_aETH_v4: {
      rateOracle: "AaveBorrowRateOracle_WETH",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 10 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1433879530305431552",
        apyLowerMultiplierWad: "556992406303772672",
        sigmaSquaredWad: "6363491421212",
        alphaWad: "570690970760459",
        betaWad: "11285394078310462",
        xiUpperWad: "77000000000000000000",
        xiLowerWad: "68000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4987292033083844",
        etaLMWad: "1465742985445261",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -13122,
    },

    // borrow cUSDT pools
    borrow_cUSDT_v3: {
      rateOracle: "CompoundBorrowRateOracle_cUSDT",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60, // todo: change
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1582588869490972672", // todo: change
        apyLowerMultiplierWad: "605609523731534208", // todo: change
        sigmaSquaredWad: "25552269089602", // todo: change
        alphaWad: "2477118510194274", // todo: change
        betaWad: "43680125585661792", // todo: change
        xiUpperWad: "16000000000000000000", // todo: change
        xiLowerWad: "36000000000000000000", // todo: change
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "3749627487603544", // todo: change
        etaLMWad: "986493887940807", // todo: change
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -14372,
    },

    // borrow aUSDT pools
    borrow_aUSDT_v3: {
      rateOracle: "AaveBorrowRateOracle_USDT",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1268332671666567424",
        apyLowerMultiplierWad: "532498757074519104",
        sigmaSquaredWad: "277844626414558",
        alphaWad: "1260442088975062",
        betaWad: "27333275616138476",
        xiUpperWad: "48000000000000000000",
        xiLowerWad: "24000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "1816728180601922",
        etaLMWad: "616718702850865",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -12721,
    },
  },

  arbitrum: {
    // aUSDC pools

    // aUSDC borrow pools
    borrow_aUSDC_v3: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1406941241730705152",
        apyLowerMultiplierWad: "500790184633923520",
        sigmaSquaredWad: "2496808645685",
        alphaWad: "244093552965375",
        betaWad: "14136010820279574",
        xiUpperWad: "16000000000000000000",
        xiLowerWad: "68000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "2988819497220332",
        etaLMWad: "1118219462831499",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -10707,
    },

    borrow_aUSDC_v4: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1682856000,
      termEndTimestamp: 1684152000,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1406941241730705152",
        apyLowerMultiplierWad: "500790184633923520",
        sigmaSquaredWad: "2496808645685",
        alphaWad: "244093552965375",
        betaWad: "14136010820279574",
        xiUpperWad: "16000000000000000000",
        xiLowerWad: "68000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "2988819497220332",
        etaLMWad: "1118219462831499",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -10607,
    },

    // GLP pools
    glpETH_v3: {
      rateOracle: "GlpRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000", // 0.1% LP Fees
      liquidatorRewardWad: "50000000000000000", // 5%
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1681300800,
      termEndTimestamp: 1685534400,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1644304481377574400",
        apyLowerMultiplierWad: "536407239345220288",
        sigmaSquaredWad: "476558919253020",
        alphaWad: "2675039466674356",
        betaWad: "26408681566976212",
        xiUpperWad: "30000000000000000000",
        xiLowerWad: "50000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4313818054680082",
        etaLMWad: "2729134122607352",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: 0,
    },
  },

  goerli: {
    // Goerli pools
    Goerli_cETH: {
      rateOracle: "CompoundRateOracle_cETH",
      // Keep timestamps 0 but change on local machine on-demand
      termStartTimestamp: 0,
      termEndTimestamp: 0,
      ...defaultConfig,
    },

    Goerli_cUSDC: {
      rateOracle: "CompoundRateOracle_cUSDC",
      // Keep timestamps 0 but change on local machine on-demand
      termStartTimestamp: 0,
      termEndTimestamp: 0,
      ...defaultConfig,
    },

    Goerli_borrow_cUSDT: {
      rateOracle: "CompoundBorrowRateOracle_cUSDT",
      // Keep timestamps 0 but change on local machine on-demand
      termStartTimestamp: 0,
      termEndTimestamp: 0,
      ...defaultConfig,
    },
  },
};

export const getNetworkPoolConfigs = (
  networkName: string
): NetworkPoolConfigurations => {
  const tmp = poolConfigs[networkName as keyof typeof poolConfigs];
  if (tmp) {
    return tmp;
  }

  throw new Error("Network not found");
};

export const getPoolConfig = (
  networkName: string,
  poolName: string
): SinglePoolConfiguration => {
  const networkConfigs = getNetworkPoolConfigs(networkName);

  const tmp = networkConfigs[poolName as keyof typeof networkConfigs];
  if (tmp) {
    return tmp;
  }

  throw new Error("Pool not found");
};
