import * as dotenv from "dotenv";

import { ethers } from "ethers";
import {
  BaseRateOracle__factory,
  ERC20__factory,
  MarginEngine__factory,
  VAMM__factory,
} from "../typechain";
import { getNetworkPools } from "./pool-addresses/pools";
import { getNetworkPoolConfigs } from "./pool-configs/poolConfig";

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

    // Retrieve pool details and configurations for each network
    const pools = getNetworkPools(network);
    const poolConfigs = getNetworkPoolConfigs(network);

    // Retrieve current block and timestamp
    const currentBlock = await provider.getBlock("latest");
    const curretTimestamp = currentBlock.timestamp;

    // Check 1. Pool configurations are subset of pools
    console.log(
      "Checking if all pool configurations have corresponding pool details..."
    );
    Object.keys(poolConfigs).forEach((poolName) => {
      if (!Object.keys(pools).includes(poolName)) {
        throw Error(
          `${poolName} is present in configurations but not in pools`
        );
      }
    });
    console.log("Check passed");
    console.log();

    // Check 2. all active pools have configurations
    console.log("Checking if all active pools have configurations...");
    for (const poolName of Object.keys(pools)) {
      const poolDetails = pools[poolName];

      // Fetch the margin engine contract
      const marginEngine = MarginEngine__factory.connect(
        poolDetails.marginEngine,
        provider
      );

      // Retrieve the term end timestamp in seconds
      const termEndTimestamp = Math.floor(
        Number(
          ethers.utils.formatUnits(await marginEngine.termEndTimestampWad(), 18)
        )
      );

      // Check whether the pool is expired or its configuration exists
      if (
        termEndTimestamp <= curretTimestamp ||
        Object.keys(poolConfigs).includes(poolName)
      ) {
        continue;
      }

      // Revert otherwise
      throw Error(`${poolName} is active but its configuration is not present`);
    }
    console.log("Check passed");
    console.log();

    // Check 3. Pool details are correct
    console.log("Checking if all pool details are correct...");
    for (const poolName of Object.keys(pools)) {
      const poolDetails = pools[poolName];

      // Fetch the margin engine contract
      const marginEngine = MarginEngine__factory.connect(
        poolDetails.marginEngine,
        provider
      );

      // Check vamm address
      const vammAddress = await marginEngine.vamm();
      if (!(vammAddress.toLowerCase() === poolDetails.vamm.toLowerCase())) {
        throw new Error(`VAMM doesn't match for ${poolName}`);
      }

      // Check token decimals
      const tokenAddress = await marginEngine.underlyingToken();
      const token = ERC20__factory.connect(tokenAddress, provider);
      const tokenDecimals = await token.decimals();

      if (!(tokenDecimals === poolDetails.decimals)) {
        throw new Error(`Token decimals don't match for ${poolName}`);
      }

      // Check deployment number
      if (poolDetails.deploymentBlock === 0) {
        throw new Error(`Deployment is not set for ${poolName}`);
      }

      // Check rate oracle ID
      const rateOracleAddress = await marginEngine.rateOracle();
      const rateOracle = BaseRateOracle__factory.connect(
        rateOracleAddress,
        provider
      );
      const rateOracleID =
        await rateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      if (!(rateOracleID === poolDetails.rateOracleID)) {
        throw new Error(`Rate oracle ID doesn't match for ${poolName}`);
      }
    }
    console.log("Check passed");
    console.log();

    // Check 4. All pool configurations match smart contracts
    console.log("Checking if all pool configurations are correct...");
    for (const poolName of Object.keys(poolConfigs)) {
      const poolConfig = poolConfigs[poolName];
      const poolDetails = pools[poolName];

      // Fetch the margin engine contract
      const marginEngine = MarginEngine__factory.connect(
        poolDetails.marginEngine,
        provider
      );

      const vamm = VAMM__factory.connect(poolDetails.vamm, provider);

      // Check tick spacing
      const tickSpacing = await vamm.tickSpacing();

      if (!(tickSpacing === poolConfig.tickSpacing)) {
        throw new Error(
          `tickSpacing doesn't match for ${poolName} configuration`
        );
      }

      // Check cache max age in seconds
      const cacheMaxAgeInSeconds = (
        await marginEngine.cacheMaxAgeInSeconds()
      ).toNumber();

      if (!(cacheMaxAgeInSeconds === poolConfig.cacheMaxAgeInSeconds)) {
        throw new Error(
          `cacheMaxAgeInSeconds doesn't match for ${poolName} configuration`
        );
      }

      // Check lookback window in seconds
      const lookbackWindowInSeconds = (
        await marginEngine.lookbackWindowInSeconds()
      ).toNumber();

      if (!(lookbackWindowInSeconds === poolConfig.lookbackWindowInSeconds)) {
        throw new Error(
          `lookbackWindowInSeconds doesn't match for ${poolName} configuration`
        );
      }

      // Check fee
      const feeWad = await vamm.feeWad();

      if (!feeWad.eq(poolConfig.feeWad)) {
        throw new Error(`feeWad doesn't match for ${poolName} configuration`);
      }

      // Check liquidator reward
      const liquidatorRewardWad = await marginEngine.liquidatorRewardWad();

      if (!liquidatorRewardWad.eq(poolConfig.liquidatorRewardWad)) {
        throw new Error(
          `liquidatorRewardWad doesn't match for ${poolName} configuration`
        );
      }

      // Check margin engine params
      const marginCalculatorParams =
        await marginEngine.marginEngineParameters();

      if (
        !Object.keys(poolConfig.marginCalculatorParams).every(
          (param: string) =>
            poolConfig.marginCalculatorParams[
              param as keyof typeof poolConfig.marginCalculatorParams
            ].toString() ===
            marginCalculatorParams[
              param as keyof typeof marginCalculatorParams
            ].toString()
        )
      ) {
        throw new Error(
          `marginCalculatorParams doesn't match for ${poolName} configuration`
        );
      }
    }
    console.log(`All checks passed for ${network}`);
    console.log();
  }
};

checkPoolInformation();
