import { task } from "hardhat/config";
import { utils } from "ethers";
import { getRateOracleByNameOrAddress } from "./utils/helpers";

// Description:
//   This task reads all entries of a given rate oracle
//
// Example:
//   ``npx hardhat queryRateOracleEntry --network mainnet --rate-oracle 0xA6BA323693f9e9B591F79fbDb947c7330ca2d7ab``

task(
  "queryRateOracleEntry",
  "Outputs the observations stored within a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT')"
  )
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    const exportFolder = `tasks/output/rate_oracle_entries`;
    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(exportFolder)) {
      fs.mkdirSync(exportFolder, { recursive: true });
    }

    // Fetch rate oracle
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );

    // Export the data to .csv file
    const exportFile = `${exportFolder}/${hre.network.name}-${taskArgs.rateOracle}.csv`;
    const header = "timestamp,value,rawTimestamp,rawValue";

    fs.writeFileSync(exportFile, header + "\n", () => {});

    // Retrieve the current size
    const oracleVars = await rateOracle.oracleVars();

    for (let i = 0; i <= oracleVars.rateIndex; i++) {
      // Get the rate oracle entry
      const observation = await rateOracle.observations(i);

      // Export the date to the .csv file
      const observationTimeString = new Date(
        observation.blockTimestamp * 1000
      ).toISOString();
      const observedValue = utils.formatUnits(observation.observedValue, 27);

      fs.appendFileSync(
        exportFile,
        `${observationTimeString},${observedValue},${
          observation.blockTimestamp
        },${observation.observedValue.toString()}\n`
      );
    }
  });

module.exports = {};
