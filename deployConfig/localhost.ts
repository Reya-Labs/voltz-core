import type { ContractsConfig } from "./types";

export const localhostConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  aaveConfig: {
    aaveTokens: [],
  },
  compoundConfig: {
    compoundTokens: [],
  },
  compoundBorrowConfig: {
    compoundTokens: [],
  },
};
