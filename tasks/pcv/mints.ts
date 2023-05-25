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

// export const mintAdjustments: MintAdjustmentParams[] = [
//   {
//     pool: "borrow_aUSDC_v3",
//     fixedRateLower: 1.5,
//     fixedRateUpper: 5,
//     newNotional: 261900000,
//   },
// ];

export const mints: MintParams[] = [];
export const mintAdjustments: MintAdjustmentParams[] = [];
