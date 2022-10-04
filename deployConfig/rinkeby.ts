import type { ContractsConfig } from "./types";

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 18 * 60 * 60, // 18 hours
};

export const rinkebyConfig: ContractsConfig = {
  weth: "0xc778417e063141139fce010982780140aa0cd5ab",
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cUSDC",
        address: "0x5b281a6dda0b271e91ae35de655ad301c976edb1",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
  // lidoConfig: {
  //   // Lido deployment info at https://github.com/lidofinance/lido-dao/tree/816bf1d0995ba5cfdfc264de4acda34a7fe93eba#mainnet
  //   lidoStETH: "0xF4242f9d78DB7218Ad72Ee3aE14469DBDE8731eD",
  //   lidoOracle: "0xADA83Afc0380A63F6b6D1bf6576C2dA5fb954b6F", // not a valid oracle :(
  //   defaults: {
  //     ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
  //     daysOfTrustedDataPoints: 20,
  //   },
  // },
};
