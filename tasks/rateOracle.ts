import { task } from "hardhat/config";
import { utils } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { getRateOracleByNameOrAddress } from "./utils/helpers";

task(
  "writeRateOracle",
  "Writes a new datapoint for a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );

    const trx = await rateOracle.writeOracleEntry({ gasLimit: 10000000 });
    await trx.wait();
  });

task(
  "queryRateOracle",
  "Outputs the observations stored within a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    // console.log(`Listing Rates known by Rate Oracle ${rateOracle.address}`);

    const underlying = await rateOracle.underlying();
    console.log("Underlying token:", underlying);

    const oracleVars = await rateOracle.oracleVars();
    // console.log(`oracleVars,${oracleVars}`);
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
      csvOutput += `\n${observationTimeString},${observedValue},${observation.blockTimestamp},"${observation.observedValue}"`;
    }
    console.log(csvOutput);
  });

task(
  "transferRateOracleOwnership",
  "Transfers rate oracle ownership to the multisig address configured in hardhat.config.ts"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );

    const { deployer, multisig } = await hre.getNamedAccounts();

    const owner = await rateOracle.owner();

    if (owner === multisig) {
      console.log(`Already owned by ${multisig}. No need to transfer`);
    } else if (owner === deployer) {
      await rateOracle.transferOwnership(multisig);
      console.log(`Ownership transferred from ${owner} to ${multisig}`);
    } else {
      console.log(
        `Cannot transfer ownership of rate oracle ${rateOracle.address} using account ${deployer} because it is owned by ${owner}`
      );
    }
  });

module.exports = {};
