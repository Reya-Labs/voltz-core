import * as mainnetPoolAddresses from "./mainnet.json";
import * as arbitrumPoolAddresses from "./arbitrum.json";

export const getAddresses = (
  networkName: string
): {
  [key: string]: {
    marginEngine: string;
    vamm: string;
    decimals: number;
    deploymentBlock: number;
    rateOracleID: number;
  };
} => {
  switch (networkName) {
    case "mainnet": {
      return mainnetPoolAddresses;
    }

    case "arbitrum": {
      return arbitrumPoolAddresses;
    }

    default: {
      throw new Error(`Unrecognized network name ${networkName}`);
    }
  }
};
