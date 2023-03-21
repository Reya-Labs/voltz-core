type MintParams = {
  pool: string;
  fixedRateLower: number;
  fixedRateUpper: number;
  marginDelta: number;
  leverage: number;
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
