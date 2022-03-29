import { network } from "hardhat";

// Manage addresses for third-party contracts
interface TokenConfig {
  name: string;
  address: string;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
}
interface ContractsConfig {
  aaveLendingPool: string;
  aaveTokens: TokenConfig[];
  compoundTokens: TokenConfig[];
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
        rateOracleBufferSize: 50,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],

    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "USDT",
        address: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
        rateOracleBufferSize: 135,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
};

export const getAaveLendingPoolAddress = (
  _networkName?: string
): string | null => {
  const networkName = _networkName || network.name;
  return config[networkName] ? config[networkName].aaveLendingPool : null;
};

export const getAaveTokens = (_networkName?: string): TokenConfig[] | null => {
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

export const getCompoundTokens = (
  _networkName?: string
): TokenConfig[] | null => {
  const networkName = _networkName || network.name;

  const compoundTokens = config[networkName]
    ? config[networkName].compoundTokens
    : null;
  // Check for duplicate token names. These must be unique because they are used to name the deployed contracts
  if (compoundTokens && duplicateExists(compoundTokens?.map((t) => t.name))) {
    throw Error(`Duplicate token names configured for network ${network.name}`);
  }
  return compoundTokens;
};
