export const getProtocolSubgraphURL = (networkName: string): string => {
  switch (networkName) {
    case "mainnet": {
      return "https://api.thegraph.com/subgraphs/name/voltzprotocol/mainnet-v1";
    }

    case "arbitrum": {
      return "https://api.thegraph.com/subgraphs/name/voltzprotocol/arbitrum-v1";
    }

    default: {
      throw new Error(`Unrecognized network name ${networkName}`);
    }
  }
};
