import { defaultConfig, gaps } from "./defaultConfig";
import {
  SinglePoolConfiguration,
  NetworkPoolConfigurations,
  PoolConfigurations,
} from "./types";

const poolConfigs: PoolConfigurations = {
  mainnet: {
    borrow_aUSDC_30Jun23: {
      rateOracle: "AaveBorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 12 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1685523600,
      termEndTimestamp: 1688126400, // Fri Jun 30 2023 12:00:00 GMT+0000
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
      initTick: -12058,
      maturityBuffer: 3600,
    },

    borrow_av3USDC_30Jun23: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1685523600,
      termEndTimestamp: 1688126400, // Fri Jun 30 2023 12:00:00 GMT+0000
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1184725046009880320",
        apyLowerMultiplierWad: "575516776378539840",
        sigmaSquaredWad: "3274342158343",
        alphaWad: "1531366392221818",
        betaWad: "24196129760001924",
        xiUpperWad: "25000000000000000000",
        xiLowerWad: "61000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4811560193370494",
        etaLMWad: "824243063488649",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -11668,
      maturityBuffer: 3600,
    },
  },

  arbitrum: {
    // aUSDC borrow pools
    borrow_av3USDC_30Jun23: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1685523600,
      termEndTimestamp: 1688126400, // Fri Jun 30 2023 12:00:00 GMT+0000
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
      initTick: -9301,
      maturityBuffer: 3600,
    },

    borrow_av3USDC_31Aug23: {
      rateOracle: "AaveV3BorrowRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 12 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1685523600,
      termEndTimestamp: 1693483200, // Thu Aug 31 2023 12:00:00 GMT+0000
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1173303936981823744",
        apyLowerMultiplierWad: "558448572781870464",
        sigmaSquaredWad: "1533367622699",
        alphaWad: "423800356487931",
        betaWad: "18682949603805884",
        xiUpperWad: "24000000000000000000",
        xiLowerWad: "44000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "2806157663420758",
        etaLMWad: "1461371640809873",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -9301,
      maturityBuffer: 3600,
    },

    // GLP pools
    glpETH_28Jun23: {
      rateOracle: "GlpRateOracle",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 14 * 24 * 60 * 60,
      feeWad: "5000000000000000", // 0.5% LP Fees
      liquidatorRewardWad: "50000000000000000", // 5%
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1685523600,
      termEndTimestamp: 1687919400, // Wed Jun 28 2023 02:30:00 GMT+0000
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1209358168717856256",
        apyLowerMultiplierWad: "228239625856421728",
        sigmaSquaredWad: "41826291005464",
        alphaWad: "4298950189896987",
        betaWad: "50217814101598760",
        xiUpperWad: "31000000000000000000",
        xiLowerWad: "55000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4993403947323154",
        etaLMWad: "1645276067621130",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -21891,
      maturityBuffer: 3600,
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

  avalanche: {
    sofrUSDC_30Sep23: {
      rateOracle: "SofrRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "200000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1684931400,
      termEndTimestamp: 1696075800, // Sat Sep 30 2023 12:10:00 GMT+0000 --- or --- 8:10am ET
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1058216188896376576",
        apyLowerMultiplierWad: "858887762298339840",
        sigmaSquaredWad: "222880325189",
        alphaWad: "24975140967129",
        betaWad: "669673528900342",
        xiUpperWad: "50000000000000000000",
        xiLowerWad: "31000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "2572246938101572",
        etaLMWad: "770952095579974",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -16096, // 5.00%
      maturityBuffer: 3600,
    },

    sofrUSDC_31Dec23: {
      rateOracle: "SofrRateOracle_USDC",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 13 * 24 * 60 * 60,
      feeWad: "200000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1684931400,
      termEndTimestamp: 1704028200, // Sun Dec 31 2023 13:10:00 GMT+0000 --- or --- 8:10am ET
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1058216188896376576",
        apyLowerMultiplierWad: "858887762298339840",
        sigmaSquaredWad: "222880325189",
        alphaWad: "24975140967129",
        betaWad: "669673528900342",
        xiUpperWad: "50000000000000000000",
        xiLowerWad: "31000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "2572246938101572",
        etaLMWad: "770952095579974",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -15262, // 4.6%
      maturityBuffer: 3600,
    },
  },

  avalancheFuji: {
    Fuji_sofrVUSD: {
      rateOracle: "SofrRateOracle_VUSD",
      tickSpacing: 60,
      cacheMaxAgeInSeconds: 21600,
      lookbackWindowInSeconds: 15 * 24 * 60 * 60,
      feeWad: "1000000000000000",
      liquidatorRewardWad: "50000000000000000",
      vammFeeProtocolWad: "0",
      isAlpha: false,
      lpMarginCap: "0",
      termStartTimestamp: 1684839365,
      termEndTimestamp: 1685556000,
      marginCalculatorParams: {
        apyUpperMultiplierWad: "1312184160984122368",
        apyLowerMultiplierWad: "756392184804765312",
        sigmaSquaredWad: "250056096553",
        alphaWad: "598386657143742",
        betaWad: "28876210592140504",
        xiUpperWad: "21000000000000000000",
        xiLowerWad: "88000000000000000000",
        tMaxWad: "31536000000000000000000000",
        etaIMWad: "4964636705503048",
        etaLMWad: "2425100518553894",
        ...gaps,
        minMarginToIncentiviseLiquidators: "0",
      },
      initTick: -16180,
      maturityBuffer: 3600,
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
