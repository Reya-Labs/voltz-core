import type { ContractsConfig } from "./types";

// const TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS = {
//   rateOracleBufferSize: 500,
//   minSecondsSinceLastUpdate: 18 * 60 * 60, // 18 hours
// };

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 3 * 60 * 60, // 3 hours
};

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 20;

export const arbitrumGoerliConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xb83C277172198E8Ec6b841Ff9bEF2d7fa524f797",
  multisig: "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1",
  aaveConfigV3: {
    // See deployment info at https://docs.aave.com/developers/deployed-contracts/v3-testnet-addresses#arbitrum-nitro-goerli
    aaveLendingPool: "0xeAA2F46aeFd7BDe8fB91Df1B277193079b727655",
    aaveLendingPoolDeploymentBlock: 16291127,
    aaveTokens: [
      // Supply markets
      {
        name: "USDC",
        borrow: false,
        address: "0x72A9c57cD5E2Ff20450e409cF6A542f1E6c710fc",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
    ],
  },
};
