import { string } from "mathjs";

// Manage addresses for third-party contracts
interface ContractsConfig {
  aaveLendingPool: string;
  testToken: string;
  initialRateOracleBufferSize: number;
}
interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}

export const config: ContractsConfigMap = {
  kovan: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",

    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    testToken: "0x13512979ADE267AB5100878E2e0f485B568328a4",

    initialRateOracleBufferSize: 5,
  },
};
