type MintParams = {
  pool: string;
  fixedRateLower: number;
  fixedRateUpper: number;
  marginDelta: number;
  leverage: number;
  token: string | undefined;
};

// Example:
//   const example: MintParams = {
//     pool: "glpETH_v2",
//     fixedRateLower: 10, // 10%
//     fixedRateUpper: 45, // 45%
//     marginDelta: 60, // 60 ETH
//     leverage: 50, // 50x leverage
//     token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // usdc (optional)
//    };

export const mints: MintParams[] = [];
