type MintAdjustmentParams = {
  pool: string;
  fixedRateLower: number;
  fixedRateUpper: number;
  // New notional of position after adjustment
  notionalDelta: number;
  // New margin of position after adjustment
  marginDelta: number;
};

// Example:
// export const mintAdjustments: MintAdjustmentParams[] = [
//   {
//     pool: "borrow_aUSDC_v3",
//     fixedRateLower: 1.5,
//     fixedRateUpper: 5,
//     newNotional: 261900000,
//     newMargin: 2619000,
//   },
// ];

export const mintAdjustments: MintAdjustmentParams[] = [
  {
    pool: "borrow_aUSDC_v6",
    fixedRateLower: 1,
    fixedRateUpper: 4,
    notionalDelta: 0,
    marginDelta: -80000,
  },
  {
    pool: "rETH_v4",
    fixedRateLower: 3,
    fixedRateUpper: 6.5,
    notionalDelta: 0,
    marginDelta: -35,
  },
  {
    pool: "stETH_v4",
    fixedRateLower: 3.5,
    fixedRateUpper: 7,
    notionalDelta: 0,
    marginDelta: -40,
  },
  {
    pool: "borrow_aETH_v4",
    fixedRateLower: 2,
    fixedRateUpper: 5.5,
    notionalDelta: 0,
    marginDelta: -18,
  },
];
