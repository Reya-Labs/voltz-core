import { task } from "hardhat/config";
import { getRateOracleByNameOrAddress } from "./utils/helpers";

// Description:
//   This task pushes an on-chain transaction to write a new entry in a given rate oracle
//
// Example:
//   ``npx hardhat writeRateOracleEntries --network mainnet --rate-oracle 0xA6BA323693f9e9B591F79fbDb947c7330ca2d7ab``

task(
  "writeRateOracleEntries",
  "Writes a new datapoint for a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT')"
  )
  .setAction(async (taskArgs, hre) => {
    // Fetch rate oracle
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );

    // Write oracle entry to the rate oracle
    const trx = await rateOracle.writeOracleEntry({ gasLimit: 10000000 });
    await trx.wait();
  });

module.exports = {};
