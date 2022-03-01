import { network } from "hardhat";

// Manage addresses for third-party contracts
interface TokenIdentifier {
  name: string;
  address: string;
}
interface ContractsConfig {
  aaveLendingPool: string;
  aaveTokens: TokenIdentifier[];
  rateOracleBufferSize: number;
}
interface ContractsConfigMap {
  [key: string]: ContractsConfig;
}

function duplicateExists(arr: string[]) {
  return new Set(arr).size !== arr.length;
}

const config: ContractsConfigMap = {
  kovan: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",

    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      {
        name: "USDT",
        address: "0x13512979ADE267AB5100878E2e0f485B568328a4",
      },
    ],

    rateOracleBufferSize: 5,
  },
};

export const getAaveLendingPoolAddress = (
  _networkName?: string
): string | null => {
  const networkName = _networkName || network.name;
  return config[networkName] ? config[networkName].aaveLendingPool : null;
};

export const getAaveTokens = (
  _networkName?: string
): TokenIdentifier[] | null => {
  const networkName = _networkName || network.name;

  const aaveTokens = config[networkName]
    ? config[networkName].aaveTokens
    : null;
  // Check for duplicate token names. These must be unique because they are used to name the deployed contracts
  if (aaveTokens && duplicateExists(aaveTokens?.map((t) => t.name))) {
    throw Error(`Duplicate token names configured for network ${network.name}`);
  }
  return aaveTokens;
};

export const getRateOracleBufferSize = (_networkName?: string): number => {
  const networkName = _networkName || network.name;
  return config[networkName] ? config[networkName].rateOracleBufferSize : 1;
};
