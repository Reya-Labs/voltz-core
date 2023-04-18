import type { ContractsConfig } from "./types";

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 20;

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 18 * 60 * 60, // 18 hours
};

export const mainnetConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 9 * 31, // 9 months. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  multisig: "0xb527E950fC7c4F581160768f48b3bfA66a7dE1f0",
  aaveConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
    aaveLendingPoolDeploymentBlock: 11367585,
    aaveTokens: [
      // Supply markets
      {
        name: "USDC",
        borrow: false,
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
      {
        name: "DAI",
        borrow: false,
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
      // {
      //   name: "WETH",
      //   address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      //   ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      //   daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      // },
      // Borrow markets
      {
        name: "USDC",
        borrow: true,
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
      {
        name: "WETH",
        borrow: true,
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
      {
        name: "USDT",
        borrow: true,
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: 5,
      },
      // {
      //   name: "DAI",
      //   borrow: true,
      //   address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      //   ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      //   daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      // },
    ],
  },
  aaveConfigV3: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    aaveLendingPoolDeploymentBlock: 16291127,
    aaveTokens: [
      // Supply markets
      {
        name: "USDC",
        borrow: false,
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
      // Borrow markets
      {
        name: "USDC",
        borrow: true,
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: 15,
      },
    ],
  },
  compoundConfig: {
    compoundTokens: [
      // Supply markets
      {
        name: "cDAI",
        address: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
        borrow: false,
      },
      // Borrow markets
      {
        name: "cUSDT",
        address: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
        borrow: true,
      },
      // {
      //   name: "cETH",
      //   address: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
      //   ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      //   daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      //   borrow: true,
      // },
    ],
  },
  lidoConfig: {
    // Lido deployment info at https://github.com/lidofinance/lido-dao/tree/816bf1d0995ba5cfdfc264de4acda34a7fe93eba#mainnet
    lidoStETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    lidoOracle: "0x442af784A788A5bd6F42A01Ebe9F287a871243fb",
    defaults: {
      ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
    },
  },
  rocketPoolConfig: {
    // RocketPool deployment info at ???
    rocketPoolRocketToken: "0xae78736cd615f374d3085123a210448e74fc6393",
    rocketNetworkBalances: "0x138313f102ce9a0662f826fca977e3ab4d6e5539",
    defaults: {
      ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
    },
  },
  skipFactoryDeploy: true, // On mainnet we use a community deployer
  factoryOwnedByMultisig: true, // On mainnet, transactions to the factory must go through a multisig
};
