import { task } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import { getRateOracleByNameOrAddress } from "./utils/helpers";
import { getConfig } from "../deployConfig/config";

// Description:
//   This task pushes an on-chain transaction to transfer ownership of a given rate oracle to multisig
//
// Example:
//   ``npx hardhat transferRateOracleOwnership --network mainnet --rate-oracle 0xA6BA323693f9e9B591F79fbDb947c7330ca2d7ab``

task(
  "transferRateOracleOwnership",
  "Transfers rate oracle ownership to the multisig address configured in hardhat.config.ts"
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

    // Get deployer address
    const { deployer } = await hre.getNamedAccounts();

    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Retrieve the current owner of the rate oracle
    const owner = await rateOracle.owner();

    // Try to transfer ownership to multisig
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
