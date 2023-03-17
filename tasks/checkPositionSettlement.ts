import { task, types } from "hardhat/config";
import { BaseRateOracle, MarginEngine } from "../typechain";
import { ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { number } from "mathjs";
import { toBn } from "evm-bn";
import { getProtocolSubgraphURL } from "../scripts/getProtocolSubgraphURL";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";

// Description:
//   This task calculates the actual settlement cashflow of a position if the pool has reached maturity;
//   otherwise, it estimates it assuming liquidity index remains 0 until the end of the pool.
//
// Example:
//   ``npx hardhat checkPositionSettlement --network mainnet --pool stETH_v1 --owner 0xf8f6b70a36f4398f0853a311dc6699aba8333cc1 --tick-lower -69060 --tick-upper 0``

task("checkPositionSettlement", "Check positions")
  .addParam("pool", "Pool name")
  .addParam("owner", "Owner of position")
  .addParam("tickLower", "Tick lower of position", "-69060", types.string)
  .addParam("tickUpper", "Tick upper of position", "0", types.string)
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolDetails = getNetworkPools(hre.network.name);

    // Check if queried pools are in the config
    if (!Object.keys(poolDetails).includes(taskArgs.pool)) {
      throw new Error(`Pool ${taskArgs.pool} is not present in the pools.`);
    }

    const pool = poolDetails[taskArgs.pool];

    // Fetch current time
    const currentTimeInMS =
      (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

    // Retrieve margin engine and rate oracle
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      pool.marginEngine
    )) as MarginEngine;

    const rateOracle = (await hre.ethers.getContractAt(
      "BaseRateOracle",
      await marginEngine.rateOracle()
    )) as BaseRateOracle;

    // Retrieve term end of the pool
    const termEndWad = await marginEngine.termEndTimestampWad();
    const timeEnd = number(ethers.utils.formatUnits(termEndWad, 18));

    // Get the queried position
    const positions = (
      await getPositions(
        getProtocolSubgraphURL(hre.network.name),
        currentTimeInMS,
        {
          ammIDs: [pool.vamm],
          owners: [taskArgs.owner],
        },
        true
      )
    ).filter(
      (position) =>
        position.tickLower === Number(taskArgs.tickLower) &&
        position.tickUpper === Number(taskArgs.tickUpper)
    );

    // Check the positions
    if (positions.length === 0) {
      console.warn("No position with the given arguments.");
      return;
    }

    if (positions.length >= 2) {
      console.warn("Multiple positions with the given arguments.");
      return;
    }

    if (positions[0].swaps.length === 0) {
      console.warn("This position does not have any swaps.");
      return;
    }

    if (1000 * timeEnd < currentTimeInMS) {
      console.warn("The given pool has not reached maturity yet!");
    }

    let totalSettlementCashflow = 0;
    for (const swap of positions[0].swaps) {
      const timeSwap = Math.floor(swap.creationTimestampInMS / 1000);

      // Compute the fixed factor
      const fixedFactor =
        ((Math.abs(swap.unbalancedFixedTokenDelta / swap.variableTokenDelta) *
          (timeEnd - timeSwap)) /
          31536000) *
        0.01;

      // Query the variable factor
      const variableFactorWad = await rateOracle.callStatic.variableFactor(
        toBn(timeSwap.toString(), 18),
        termEndWad
      );

      const variableFactor = Number(
        ethers.utils.formatUnits(variableFactorWad, 18)
      );

      // Calculate settlement cashflow of this swap and add it to the total sum
      const swapSettlementCashflow =
        swap.variableTokenDelta * (variableFactor - fixedFactor);

      totalSettlementCashflow += swapSettlementCashflow;
    }

    console.log("Settlement cashflow:", totalSettlementCashflow);
  });

module.exports = {};
