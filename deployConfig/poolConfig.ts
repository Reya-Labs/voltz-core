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
    gammaWad: BigNumberish;
    minMarginToIncentiviseLiquidators: BigNumberish;
  };
}

export const poolConfigs: { [name: string]: poolConfig } = {
  borrow_aWETH: {
    rateOracle: "AaveBorrowRateOracle_WETH",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 1210000,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1397400738057530000",
      apyLowerMultiplierWad: "485064375381923000",
      sigmaSquaredWad: "1445495381827",
      alphaWad: "659795048123794",
      betaWad: "45272788682406600",
      xiUpperWad: "23000000000000000000",
      xiLowerWad: "19000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "7044480334384290000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  borrow_aUSDC: {
    rateOracle: "AaveBorrowRateOracle_USDC",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 1037000,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_500_000, 6), // note USDC uses 6 decimals
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1455402035553240000",
      apyLowerMultiplierWad: "669835733764130000",
      sigmaSquaredWad: "584134737056",
      alphaWad: "2320891126624",
      betaWad: "72888787360395",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "45000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "767513112240941000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  borrow_cUSDT: {
    rateOracle: "CompoundBorrowRateOracle_cUSDT",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 864000,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_500_000, 6), // note USDT uses 6 decimals
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1569111833041750000",
      apyLowerMultiplierWad: "428269285426040000",
      sigmaSquaredWad: "1117470060981",
      alphaWad: "152678828461170",
      betaWad: "10548028440226400",
      xiUpperWad: "29000000000000000000",
      xiLowerWad: "35000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "190376002522701000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

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
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "5000000000000000000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  borrow_cUSDC: {
    rateOracle: "CompoundBorrowRateOracle_cUSDC",
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
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
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
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
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
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "5000000000000000000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  borrow_cETH: {
    rateOracle: "CompoundBorrowRateOracle_cETH",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 259200,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "2000088888888889088",
      apyLowerMultiplierWad: "647682882882882944",
      sigmaSquaredWad: "455732536000",
      alphaWad: "333849845030233",
      betaWad: "8257510332280466",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "1851933333333333504",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  new_rETH: {
    rateOracle: "RocketPoolRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 864000,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1109227605790384260",
      apyLowerMultiplierWad: "279917023603821600",
      sigmaSquaredWad: "2528169099842",
      alphaWad: "507927122024010",
      betaWad: "29317571863063692",
      xiUpperWad: "19000000000000000000",
      xiLowerWad: "29000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "349947520823911000",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  old_rETH: {
    rateOracle: "RocketPoolRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 3110400, // in seconds (convert from days to seconds)
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "4272790909090909000", // tau_u
      apyLowerMultiplierWad: "842858558558558464", // tau_d
      sigmaSquaredWad: "918445178044",
      alphaWad: "961807512842816",
      betaWad: "27823751368703388",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "130228828828828832", // gama_unwind
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  new_stETH: {
    rateOracle: "LidoRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 1037000,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "1303107786000816000",
      apyLowerMultiplierWad: "695102361198979300",
      sigmaSquaredWad: "287882365187",
      alphaWad: "76667205124232",
      betaWad: "2696112367796010",
      xiUpperWad: "22000000000000000000",
      xiLowerWad: "31000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "383571596591587140",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  old_stETH: {
    rateOracle: "LidoRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 604800,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "9363643434343434240",
      apyLowerMultiplierWad: "362426126126126144",
      sigmaSquaredWad: "464858948072",
      alphaWad: "20629920252239",
      betaWad: "732502784107384",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gammaWad: "20119819819819820",
      minMarginToIncentiviseLiquidators: "0",
    },
  },
};
