import { BigNumber as BN, utils } from "ethers";
const ONE_E_18 = BN.from(10).pow(18);
const ONE_DAY = BN.from(86400);

export const common = {
  ONE_E_18,
  RATE_AAVE_V2: utils.formatBytes32String("AaveV2"),
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  // MAX_ALLOWANCE: BN.from(2).pow(BN.from(256)).sub(BN.from(1)),
  ONE_DAY,
  // TEST_EXPIRY: 1624147200,
  HIGH_GAS_OVERRIDE: { gasLimit: 80000000 },

  // Protocol params;
  // example below
  // LOCK_NUMERATOR: BN.from(1),
  // Fee
};

export const devConstants = {
  common,
  misc: {
    AAVE_V2_LENDING_POOL_ADDRESS: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
  },
  tokens: {
    USDT_AAVE: {
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    },
    USDT_COMPOUND: {
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    },
    WETH: {
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      decimal: 18,
      compound: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
    },
    USDC: {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimal: 6,
      compound: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
    },
    AUSDC: {
      address: "0xbcca60bb61934080951369a648fb03df4f96263c",
    },
    CDAI: {
      address: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
    },
    DAI: {
      address: "0x6b175474e89094c44da98b954eedeac495271d0f",
    },
    AUSDT: {
      address: "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8",
      decimal: 6,
      owner: "0x4188a7dca2757ebc7d9a5bd39134a15b9f3c6402",
    },
  },
};

// todo: export const kovanConstants
// todo: export const goerliConstants

export const mainnetConstants = {
  common,
  misc: {
    AAVE_V2_LENDING_POOL_ADDRESS: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", //checked *1
  },
  tokens: {
    USDT_AAVE: {
      // USDT
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    },
    USDT_COMPOUND: {
      // USDT
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimal: 6,
      owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
      compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    },
    WETH: {
      // must check
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // checked * 2
      decimal: 18,
      compound: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5", // cEther - checked * 2
    },
    USDC: {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // checked * 2
      decimal: 6,
      compound: "0x39aa39c021dfbae8fac545936693ac917d5e7563", // cUSDC - checked * 2
    },
    // AUSDT: {
    //   address: '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
    //   decimal: 6,
    //   owner: '0x4188a7dca2757ebc7d9a5bd39134a15b9f3c6402',
    // },
  },
};
