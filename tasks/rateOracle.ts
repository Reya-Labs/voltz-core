import { task } from "hardhat/config";
import { utils } from "ethers";
import { BaseRateOracle } from "../typechain";

task(
  "writeRateOracle",
  "Writes a new datapoint for a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = (await hre.ethers.getContract(
      taskArgs.rateOracle
    )) as BaseRateOracle;
    // console.log(`Listing Rates known by Rate Oracle ${rateOracle.address}`);

    const trx = await rateOracle.writeOracleEntry();
    await trx.wait();
  });

task(
  "queryRateOracle",
  "Outputs the observations stored within a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = (await hre.ethers.getContract(
      taskArgs.rateOracle
    )) as BaseRateOracle;
    // console.log(`Listing Rates known by Rate Oracle ${rateOracle.address}`);

    const oracleVars = await rateOracle.oracleVars();
    let csvOutput = `timestamp,value,rawTimestamp,rawValue`;

    for (let i = 0; i <= oracleVars.rateIndex; i++) {
      const observation = await rateOracle.observations(i);
      const observationTimeString = new Date(
        observation.blockTimestamp * 1000
      ).toISOString();
      const observedValue = utils.formatUnits(observation.observedValue, 27);

      if (!observation.initialized) {
        throw new Error(
          `Error reading data from oracle buffer at position ${i}`
        );
      }
      csvOutput += `\n${observationTimeString},${observedValue},${observation.blockTimestamp},${observation.observedValue}`;
    }
    console.log(csvOutput);
  });

module.exports = {};
