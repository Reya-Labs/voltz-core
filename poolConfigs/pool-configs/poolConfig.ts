import { defaultConfig, gaps } from "./defaultConfig";
import {
  SinglePoolConfiguration,
  NetworkPoolConfigurations,
  PoolConfigurations,
} from "./types";

const poolConfigs: PoolConfigurations = {
  mainnet: {
    // aUSDC pools
    aUSDC_v12: {
      rateOracle: "AaveRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
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
    },

    aUSDC_v13: {
      rateOracle: "AaveV3RateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 11 * 24 * 60 * 60,
      feeWad: "1000000000000000", // 0.1% LP Fees
      liquidatorRewardWad: "50000000000000000", // 5%
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1681473600,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1159016137597612800",
        apyLowerMultiplierWad: "697533314566558592",
        sigmaSquaredWad: "11396752774577",
        alphaWad: "191474938067075",
        betaWad: "12407346123289388",
        xiUpperWad: "25000000000000000000",
        xiLowerWad: "58000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4770298246303525",
        etaLMWad: "2465624315953315",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
    },

    // borrow aUSDC pools
    borrow_aUSDC_v2: {
      rateOracle: "AaveBorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 12 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
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
    },

    // aDAI pools

    // cDAI pools

    // stETH pools
    stETH_v3: {
      rateOracle: "LidoRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 10 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
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
    },

    // rETH pools
    rETH_v3: {
      rateOracle: "RocketPoolRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
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
    },

    // aETH pools

    // borrow aETH pools
    borrow_aETH_v3: {
      rateOracle: "AaveBorrowRateOracle_WETH",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 10 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
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
    },

    // borrow cUSDT pools
    borrow_cUSDT_v2: {
      rateOracle: "CompoundBorrowRateOracle_cUSDT",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1622945448515563776",
        apyLowerMultiplierWad: "650475034750799616",
        sigmaSquaredWad: "65256133947828",
        alphaWad: "1197791293979234",
        betaWad: "19412328022948872",
        xiUpperWad: "58000000000000000000",
        xiLowerWad: "46000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4917279176440265",
        etaLMWad: "2482000814007251",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
    },

    // borrow aUSDT pools
    borrow_aUSDT_v2: {
      rateOracle: "AaveBorrowRateOracle_USDT",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
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
    },
  },

  arbitrum: {
    // aUSDC pools
    aUSDC_v2: {
      rateOracle: "AaveV3RateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 11 * 24 * 60 * 60,
      feeWad: "1000000000000000", // 0.1% LP Fees
      liquidatorRewardWad: "50000000000000000", // 5%
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1681473600,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1373338572872450048",
        apyLowerMultiplierWad: "510202508166526656",
        sigmaSquaredWad: "5451985923144",
        alphaWad: "189947841646708",
        betaWad: "12834622078787368",
        xiUpperWad: "26000000000000000000",
        xiLowerWad: "68000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4994214047644630",
        etaLMWad: "1561103621408768",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
    },

    // aUSDC borrow pools
    borrow_aUSDC_v1: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 11 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1680264000,
      termEndTimestamp: 1682856000,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1055780406407716096",
        apyLowerMultiplierWad: "619085035084998656",
        sigmaSquaredWad: "6704058141044",
        alphaWad: "46902374877651",
        betaWad: "2509066255330718",
        xiUpperWad: "30000000000000000000",
        xiLowerWad: "68000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "1667098101341705",
        etaLMWad: "667281832268321",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
    },

    // GLP pools
    glpETH_v2: {
      rateOracle: "GlpRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000", // 0.1% LP Fees
      liquidatorRewardWad: "50000000000000000", // 5%
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1678874727,
      termEndTimestamp: 1681300800,
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
