import type { ContractsConfig } from "./types";

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 20;

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 18 * 60 * 60, // 18 hours
};

export const arbitrumConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 9 * 31, // 9 months. Do not increase without checking that rate oracle buffers are large enough
  weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  aaveConfigV3: {
    // See deployment info at https://docs.aave.com/developers/deployed-contracts/v3-mainnet/arbitrum
    aaveLendingPool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    aaveLendingPoolDeploymentBlock: 7742429,
    aaveTokens: [
      // Supply markets
      {
        name: "USDC",
        borrow: false,
        address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
    ],
  },
  skipFactoryDeploy: true, // On mainnet we use a community deployer
  factoryOwnedByMultisig: true, // On mainnet, transactions to the factory must go through a multisig
};
