import type { ContractsConfig } from "./types";

export const avalancheFujiConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  // weth: "0xD9D01A9F7C810EC035C0e42cB9E80Ef44D7f8692", // wavax
  multisig: "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1",
};
