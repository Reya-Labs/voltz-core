import type { ContractsConfig } from "./types";

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 5;

const ONE_YEAR_OF_EIGHT_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 1095, // 1 yaer worth of updates
  minSecondsSinceLastUpdate: 8 * 60 * 60, // 8 hours
};

export const localhostConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 9 * 31, // 9 months. Do not increase without checking that rate oracle buffers are large enough
  weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  multisig: "0x8DC15493a8041f059f18ddBA98ee7dcf93b838Ad",
  // aaveConfigV3: {
  //   // See deployment info at https://docs.aave.com/developers/deployed-contracts/v3-mainnet/arbitrum
  //   aaveLendingPool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  //   aaveLendingPoolDeploymentBlock: 7742429,
  //   aaveTokens: [
  //     // Supply markets
  //     {
  //       name: "USDC",
  //       borrow: false,
  //       address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  //       ...ONE_YEAR_OF_EIGHT_HOURLY_DATAPOINTS,
  //       daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
  //     },
  //   ],
  // },
  glpConfig: {
    // See deployment info at https://gmxio.gitbook.io/gmx/contracts
    rewardRouter: "0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1",
    rewardRouterDeploymentBlock: 6872609,
    rewardToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    defaults: {
      ...ONE_YEAR_OF_EIGHT_HOURLY_DATAPOINTS,
      daysOfTrustedDataPoints: 15,
    },
  },
  skipFactoryDeploy: true, // On mainnet we use a community deployer
  factoryOwnedByMultisig: true, // On mainnet, transactions to the factory must go through a multisig
};