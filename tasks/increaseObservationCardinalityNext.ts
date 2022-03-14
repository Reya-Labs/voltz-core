import { task } from "hardhat/config";
import { IRateOracle } from "../typechain";

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
