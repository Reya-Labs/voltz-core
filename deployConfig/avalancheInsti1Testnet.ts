import type { ContractsConfig } from "./types";

export const avalancheInsti1Testnet: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 9 * 31, // 9 months. Do not increase without checking that rate oracle buffers are large enough
  weth: "",
  multisig: "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1",
};
