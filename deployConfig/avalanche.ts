import type { ContractsConfig } from "./types";

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 20;

const ONE_YEAR_OF_EIGHT_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 1095, // 1 year worth of updates
  minSecondsSinceLastUpdate: 8 * 60 * 60, // 8 hours
};

export const avalancheConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 9 * 31, // 9 months. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // wavax
  multisig: "0x7D48F1AC18E3b60387271535E29258da26C02030",
  sofrConfig: {
    sofrIndexValue: "0x558Da9D3550e6676f5512269B3fAB352D4Dea9D3",
    sofrIndexEffectiveDate: "0x6da16a19824Bc16831150787624AE82ac0B277Fd",
    tokens: [
      {
        name: "USDC",
        address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
        ...ONE_YEAR_OF_EIGHT_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
    ],
  },
  skipFactoryDeploy: true,
};
