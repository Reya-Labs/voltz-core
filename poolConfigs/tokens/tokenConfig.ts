import { NetworkTokens, Tokens } from "./types";

const tokens: Tokens = {
  mainnet: {
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    TUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  arbitrum: {
    USDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  },
};

export const getNetworkTokens = (networkName: string): NetworkTokens => {
  const tmp = tokens[networkName as keyof typeof tokens];
  if (tmp) {
    return tmp;
  }

  throw new Error("Network not found");
};

export const getTokenAddress = (
  networkName: string,
  tokenName: string
): string => {
  const networkTokens = getNetworkTokens(networkName);

  const tmp = networkTokens[tokenName as keyof typeof networkTokens];
  if (tmp) {
    return tmp;
  }

  throw new Error(`Token ${tokenName} not found on ${networkName}.`);
};
