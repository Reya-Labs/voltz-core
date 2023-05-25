import type { ContractsConfig } from "./types";

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 3 * 60 * 60, // 3 hours
};

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 20;

export const avalancheFujiConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xd00ae08403b9bbb9124bb305c09058e32c39a48c", // wavax
  multisig: "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1",
  sofrConfig: {
    sofrIndexValue: "0x12bd99a29fA3f24A857288DcCDE922D8f498c737",
    sofrIndexEffectiveDate: "0x93CF2aF3071D10131F063f69AAb468a7F2279c52",
    tokens: [
      {
        name: "VUSD",
        address: "0x54B868B03c68A1307B24fB0A4b60b18A0714a94C",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
    ],
  },
  skipFactoryDeploy: true,
};
