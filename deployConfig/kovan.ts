import type { ContractsConfig, RateOracleConfigDefaults } from "./types";

export const kovanRateOracleConfigDefaults: RateOracleConfigDefaults = {
  rateOracleBufferSize: 200, // For mock token oracle
  minSecondsSinceLastUpdate: 6 * 60 * 60, // FOr mock token oracle. 6 hours
  trustedDataPoints: [],
};

export const kovanConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
  aaveConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      // {
      //   name: "USDT",
      //   address: "0x13512979ADE267AB5100878E2e0f485B568328a4",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      {
        name: "USDC",
        address: "0xe22da380ee6B445bb8273C81944ADEB6E8450422",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "TUSD",
        address: "0x016750ac630f711882812f24dba6c95b9d35856d",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
        trustedDataPoints: [],
      },
      {
        name: "WETH",
        address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      // {
      //   name: "UNI",
      //   address: "0x075A36BA8846C6B6F53644fDd3bf17E5151789DC",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "BAT",
      //   address: "0x2d12186fbb9f9a8c28b3ffdd4c42920f8539d738",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "BUSD",
      //   address: "0x4c6E1EFC12FDfD568186b7BAEc0A43fFfb4bCcCf",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "REN",
      //   address: "0x5eebf65a6746eed38042353ba84c8e37ed58ac6f",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "MRK",
      //   address: "0x61e4CAE3DA7FD189e52a4879C7B8067D7C2Cc0FA",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
    ],
  },
  aaveBorrowConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      {
        name: "USDC",
        address: "0xe22da380ee6B445bb8273C81944ADEB6E8450422",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "TUSD",
        address: "0x016750ac630f711882812f24dba6c95b9d35856d",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
        trustedDataPoints: [],
      },
      {
        name: "WETH",
        address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cUSDC",
        address: "0x4a92e71227d294f041bd82dd8f78591b75140d63",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
};
