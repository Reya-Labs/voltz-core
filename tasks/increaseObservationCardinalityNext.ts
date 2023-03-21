import { task } from "hardhat/config";
import { IRateOracle } from "../typechain";

// Description:
//   This task increases the buffer of a given rate oracle
//
// Example:
//   ``npx hardhat increaseObservationCardinalityNext --network mainnet --rateoracleaddress 0xA6BA323693f9e9B591F79fbDb947c7330ca2d7ab --ratecardinalitynext 600``

task("increaseObservationCardinalityNext", "increaseObservationCardinalityNext")
  .addParam("rateoracleaddress", "rateoracleaddress")
  .addParam("ratecardinalitynext", "ratecardinalitynext")
  .setAction(async (taskArgs, hre) => {
    const rateOracleAddress = taskArgs.rateoracleaddress;
    const size = parseInt(taskArgs.ratecardinalitynext);

    const rateOracle = (await hre.ethers.getContractAt(
      "IRateOracle",
      rateOracleAddress
    )) as IRateOracle;

    await rateOracle.increaseObservationCardinalityNext(size);
  });

module.exports = {};
