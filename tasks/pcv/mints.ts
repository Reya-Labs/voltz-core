type MintParams = {
  pool: string;
  fixedRateLower: number;
  fixedRateUpper: number;
  marginDelta: number;
  leverage: number;
};

type MintAdjustmentParams = {
  pool: string;
  fixedRateLower: number;
  fixedRateUpper: number;
  // New notional of position after adjustment
  newNotional: number;
};

// Example:
//   const example: MintParams = {
//     pool: "glpETH_v2",
//     fixedRateLower: 10, // 10%
//     fixedRateUpper: 45, // 45%
//     marginDelta: 60, // 60 ETH
//     leverage: 50, // 50x leverage
//    };

export const mints: MintParams[] = [];
export const mintAdjustments: MintAdjustmentParams[] = [
  {
    pool: "aUSDC_v15",
    fixedRateLower: 1,
    fixedRateUpper: 4,
    newNotional: 345700000,
  },
  {
    pool: "borrow_aETH_v4",
    fixedRateLower: 2,
    fixedRateUpper: 5.5,
    newNotional: 40275,
  },
  {
    pool: "borrow_aUSDC_v4",
    fixedRateLower: 2,
    fixedRateUpper: 5,
    newNotional: 392300000,
  },
  {
    pool: "borrow_aUSDC_v6",
    fixedRateLower: 1,
    fixedRateUpper: 4,
    newNotional: 350000000,
  },
  {
    pool: "borrow_aUSDT_v3",
    fixedRateLower: 2,
    fixedRateUpper: 5.5,
    newNotional: 42850000,
  },
  {
    pool: "borrow_cUSDT_v3",
    fixedRateLower: 2,
    fixedRateUpper: 5.5,
    newNotional: 107350000,
  },
  {
    pool: "rETH_v4",
    fixedRateLower: 3,
    fixedRateUpper: 6.5,
    newNotional: 49815,
  },
  {
    pool: "stETH_v4",
    fixedRateLower: 3.5,
    fixedRateUpper: 7,
    newNotional: 43875,
  },
];

// export const mintAdjustments: MintAdjustmentParams[] = [
//   {
//     pool: "borrow_aUSDC_v3",
//     fixedRateLower: 1.5,
//     fixedRateUpper: 5,
//     newNotional: 261900000,
//   },
// ];
