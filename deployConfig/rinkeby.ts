import type { ContractsConfig } from "./types";

export const rinkebyConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cUSDC",
        address: "0x5b281a6dda0b271e91ae35de655ad301c976edb1",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
};
