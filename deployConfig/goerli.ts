import type { ContractsConfig } from "./types";

const TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 18 * 60 * 60, // 18 hours
};

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 3 * 60 * 60, // 3 hours
};

const DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS = 20;

export const goerliConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 64, // 64 days. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
  multisig: "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1",
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cETH",
        borrow: false,
        address: "0x20572e4c090f15667cf7378e16fad2ea0e2f3eff",
        ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
      },
      {
        name: "cDAI",
        borrow: false,
        address: "0x822397d9a55d0fefd20f5c4bcab33c5f65bd28eb",
        ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
      },
      {
        name: "cUSDC",
        borrow: false,
        address: "0xcec4a43ebb02f9b80916f1c718338169d6d5c1f0",
        ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
      },
      {
        name: "cETH",
        borrow: true,
        address: "0x20572e4c090f15667cf7378e16fad2ea0e2f3eff",
        ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: 10,
      },
      {
        name: "cUSDT",
        borrow: true,
        address: "0x5A74332C881Ea4844CcbD8458e0B6a9B04ddb716",
        ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
      },
      {
        name: "cUSDC",
        borrow: true,
        address: "0xcec4a43ebb02f9b80916f1c718338169d6d5c1f0",
        ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: 10,
      },
    ],
  },
  lidoConfig: {
    lidoStETH: "0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F",
    lidoOracle: "0x24d8451BC07e7aF4Ba94F69aCDD9ad3c6579D9FB",
    defaults: {
      ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
      daysOfTrustedDataPoints: 10,
    },
  },
  rocketPoolConfig: {
    rocketPoolRocketToken: "0x178e141a0e3b34152f73ff610437a7bf9b83267a",
    rocketNetworkBalances: "0x28cea7b0f3916c1dba667d3d58ec4836ad843c49",
    defaults: {
      ...TWO_MONTHS_OF_SIX_HOURLY_DATAPOINTS,
      daysOfTrustedDataPoints: 10,
    },
  },
  aaveConfigV3: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0x7b5C526B7F8dfdff278b4a3e045083FBA4028790",
    aaveLendingPoolDeploymentBlock: 16291127,
    aaveTokens: [
      // Supply markets
      {
        name: "USDC",
        borrow: false,
        address: "0x65aFADD39029741B3b8f0756952C74678c9cEC93",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: DEFAULT_DAYS_OF_TRUSTED_DATA_POINTS,
      },
    ],
  },
};
