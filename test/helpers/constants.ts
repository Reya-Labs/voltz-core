import { BigNumber, utils } from "ethers";

export type Token = {
  address: string;
  decimal: number;
  compound?: string;
  owner?: string;
  source?: string;
};

type TokenMap = Record<string, Token>;

export const tokens: TokenMap = {
  USDT: {
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimal: 6,
    compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
  },
  WETH: {
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    decimal: 18,
    compound: "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5",
  },
  USDC: {
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimal: 6,
    compound: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
  },
};

export const consts = {
  DUMMY_ADDRESS: "0xDEADbeEfEEeEEEeEEEeEEeeeeeEeEEeeeeEEEEeE",

  COMPOUND_COMPTROLLER_ADDRESS: "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b",
  AAVE_V2_LENDING_POOL_ADDRESS: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
  AAVE_DUMMY_REFERRAL_CODE: 0,
  AAVE_RATE_DECIMALS: 27,

  ZERO_BYTES: utils.formatBytes32String(""),
  RANDOM_BYTES: utils.formatBytes32String("ZpTw6Y3Ft4ruk7pmwTJF"),
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  RANDOM_ADDRESS: "0x0000000000000000000000000000000000000123",
  ETH_ADDRESS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  INF: BigNumber.from(2).pow(256).sub(1),
  DEFAULT_CHAIN_ID: 31337,
  ONE_HOUR: BigNumber.from(3600),
  ONE_DAY: BigNumber.from(86400),
  ONE_WEEK: BigNumber.from(86400 * 7),
  FIFTEEN_DAY: BigNumber.from(86400 * 15),
  ONE_MONTH: BigNumber.from(2592000),
  THREE_MONTH: BigNumber.from(2592000 * 3),
  FIVE_MONTH: BigNumber.from(2592000 * 5),
  SIX_MONTH: BigNumber.from(2592000 * 6),
  ONE_YEAR: BigNumber.from(31536000),

  HG: { gasLimit: 80000000 },
  LG: { gasLimit: 200000 },
};
