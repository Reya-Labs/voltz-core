type MintAdjustmentParams = {
  pool: string;
  fixedRateLower: number;
  fixedRateUpper: number;
  // Notional Delta (wrt current notional)
  notionalDelta: number;
  // Margin Delta (wrt current margin)
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

export const mintAdjustments: MintAdjustmentParams[] = [];
