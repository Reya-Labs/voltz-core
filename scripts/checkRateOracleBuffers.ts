import * as dotenv from "dotenv";

import { ethers } from "ethers";
import { BaseRateOracle__factory, MarginEngine__factory } from "../typechain";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";

dotenv.config();

const networks = ["mainnet", "arbitrum"];

const checkPoolInformation = async () => {
  for (const network of networks) {
    console.log(`Kicking off checks for ${network}...`);

    // Build the JSON RPC provider for each network
    const providerKey = `${network.toUpperCase()}_URL`;
    const provider = new ethers.providers.JsonRpcProvider(
      process.env[providerKey] || ""
    );

    // Retrieve pool details for each network
    const pools = getNetworkPools(network);

    // Check rate oracle buffers of all pools
    console.log("Checking rate oracle buffers of all pools...");

    const rateOracleAddresses: string[] = [];
    for (const poolName of Object.keys(pools)) {
      const poolDetails = pools[poolName];

      // Fetch the margin engine contract
      const marginEngine = MarginEngine__factory.connect(
        poolDetails.marginEngine,
        provider
      );

      // Retrieve the rate oracle address
      const rateOracleAddress = await marginEngine.rateOracle();

      // Add the rate oracle address if it's not in there yet
      if (!rateOracleAddresses.includes(rateOracleAddress)) {
        rateOracleAddresses.push(rateOracleAddress);
      }
    }

    for (const rateOracleAddress of rateOracleAddresses) {
      const rateOracle = BaseRateOracle__factory.connect(
        rateOracleAddress,
        provider
      );

      const oracleVars = await rateOracle.oracleVars();
      const minSecondsSinceLastUpdate = (
        await rateOracle.minSecondsSinceLastUpdate()
      ).toNumber();

      const delta =
        ((oracleVars.rateCardinality - oracleVars.rateIndex) *
          minSecondsSinceLastUpdate) /
        86400;

      if (delta < 30) {
        console.log(
          `Warning: The following rate oracle can reach limit in less than 30 days.`
        );
      }
      console.log(
        `Rate oracle ${rateOracleAddress} will reach limit in minimum ${delta} days.`
      );
      console.log();
    }
  }
};

checkPoolInformation();
