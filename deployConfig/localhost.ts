import type { ContractsConfig } from "./types";

export const localhostConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  multisig: "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1",
  aaveConfig: {
    aaveTokens: [],
  },
  compoundConfig: {
    compoundTokens: [],
  },
};
