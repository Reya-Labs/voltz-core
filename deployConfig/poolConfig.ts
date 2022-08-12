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
      xiUpperWad: "35000000000000000000",
      xiLowerWad: "29000000000000000000",
      tMaxWad: "31536000000000000000000000",
      devMulLeftUnwindLMWad: "111091322511942000",
      devMulRightUnwindLMWad: "111091322511942000",
      devMulLeftUnwindIMWad: "186450525979652000",
      devMulRightUnwindIMWad: "186450525979652000",
      fixedRateDeviationMinLeftUnwindLMWad: "60560652573964200",
      fixedRateDeviationMinRightUnwindLMWad: "60560652573964200",
      fixedRateDeviationMinLeftUnwindIMWad: "7412336413398469",
      fixedRateDeviationMinRightUnwindIMWad: "7412336413398469",
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
      devMulLeftUnwindLMWad: "1281368468468468480",
      devMulRightUnwindLMWad: "1281368468468468480",
      devMulLeftUnwindIMWad: "4584638738738738688",
      devMulRightUnwindIMWad: "4584638738738738688",
      fixedRateDeviationMinLeftUnwindLMWad: "149747474747474752",
      fixedRateDeviationMinRightUnwindLMWad: "149747474747474752",
      fixedRateDeviationMinLeftUnwindIMWad: "149747474747474752",
      fixedRateDeviationMinRightUnwindIMWad: "149747474747474752",
      gammaWad: "1851933333333333504",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  rETH: {
    rateOracle: "RocketPoolRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 3110400,
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
      devMulLeftUnwindLMWad: "1281368468468468480",
      devMulRightUnwindLMWad: "1281368468468468480",
      devMulLeftUnwindIMWad: "4584638738738738688",
      devMulRightUnwindIMWad: "4584638738738738688",
      fixedRateDeviationMinLeftUnwindLMWad: "149747474747474752",
      fixedRateDeviationMinRightUnwindLMWad: "149747474747474752",
      fixedRateDeviationMinLeftUnwindIMWad: "149747474747474752",
      fixedRateDeviationMinRightUnwindIMWad: "149747474747474752",
      gammaWad: "1851933333333333504",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  old_rETH: {
    rateOracle: "RocketPoolRateOracle",
    tickSpacing: 60,
    cacheMaxAgeInSeconds: 21600,
    lookbackWindowInSeconds: 3110400,
    feeWad: "3000000000000000",
    liquidatorRewardWad: "50000000000000000",
    vammFeeProtocolWad: "0",
    isAlpha: true,
    lpMarginCap: toBn(1_300, 18),
    marginCalculatorParams: {
      apyUpperMultiplierWad: "4272790909090909000",
      apyLowerMultiplierWad: "842858558558558464",
      sigmaSquaredWad: "918445178044",
      alphaWad: "961807512842816",
      betaWad: "27823751368703388",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      devMulLeftUnwindLMWad: "290387387387387392",
      devMulRightUnwindLMWad: "290387387387387392",
      devMulLeftUnwindIMWad: "4914965765765766144",
      devMulRightUnwindIMWad: "4914965765765766144",
      fixedRateDeviationMinLeftUnwindLMWad: "49242424242424240",
      fixedRateDeviationMinRightUnwindLMWad: "49242424242424240",
      fixedRateDeviationMinLeftUnwindIMWad: "135676767676767680",
      fixedRateDeviationMinRightUnwindIMWad: "135676767676767680",
      gammaWad: "130228828828828832",
      minMarginToIncentiviseLiquidators: "0",
    },
  },

  stETH: {
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
      apyUpperMultiplierWad: "1909180808080808192",
      apyLowerMultiplierWad: "599639639639639680",
      sigmaSquaredWad: "4943828635342",
      alphaWad: "235469581617579",
      betaWad: "5235590384800038",
      xiUpperWad: "39000000000000000000",
      xiLowerWad: "98000000000000000000",
      tMaxWad: "31536000000000000000000000",
      devMulLeftUnwindLMWad: "2032111711711712256",
      devMulRightUnwindLMWad: "2032111711711712256",
      devMulLeftUnwindIMWad: "3523588288288288768",
      devMulRightUnwindIMWad: "3523588288288288768",
      fixedRateDeviationMinLeftUnwindLMWad: "115575757575757584",
      fixedRateDeviationMinRightUnwindLMWad: "115575757575757584",
      fixedRateDeviationMinLeftUnwindIMWad: "147737373737373760",
      fixedRateDeviationMinRightUnwindIMWad: "147737373737373760",
      gammaWad: "20119819819819820",
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
      devMulLeftUnwindLMWad: "480575675675675712",
      devMulRightUnwindLMWad: "480575675675675712",
      devMulLeftUnwindIMWad: "9519524324324325376",
      devMulRightUnwindIMWad: "9519524324324325376",
      fixedRateDeviationMinLeftUnwindLMWad: "91454545454545456",
      fixedRateDeviationMinRightUnwindLMWad: "91454545454545456",
      fixedRateDeviationMinLeftUnwindIMWad: "165828282828282816",
      fixedRateDeviationMinRightUnwindIMWad: "165828282828282816",
      gammaWad: "20119819819819820",
      minMarginToIncentiviseLiquidators: "0",
    },
  },
};
