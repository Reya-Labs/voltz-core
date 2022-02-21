import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { toBn } from "../test/helpers/toBn";
const DURATION_IN_SECONDS = 2592000; // 2592000 seconds = 30 days

const func: DeployFunction = async function (_: HardhatRuntimeEnvironment) {
  // Simple script for testing purposes only
  // Deploys an Interest Rate Swap instance, with a thirty day duration starting right now.

  // To Deploy an IRS instance, we need
  const factory = await ethers.getContractOrNull("Factory");
  const mockToken = await ethers.getContractOrNull("ERC20Mock");
  const rateOracleForMockedToken = await ethers.getContractOrNull(
    "TestRateOracle"
  );
  const block = await ethers.provider.getBlock("latest");
  const startTimestamp = block.timestamp;
  const endTimestamp = startTimestamp + DURATION_IN_SECONDS;

  if (factory && mockToken && rateOracleForMockedToken) {
    console.log(
      `Creating test IRS for mock token/rate oracle: {${mockToken.address}, ${rateOracleForMockedToken.address}}`
    );
    const deployTrx = await factory.deployIrsInstance(
      mockToken.address,
      rateOracleForMockedToken.address,
      toBn(startTimestamp), // converting to wad
      toBn(endTimestamp) // converting to wad
    );
    const receipt = await deployTrx.wait();
    // console.log(receipt);

    if (!receipt.status) {
      console.error("IRS creation failed!");
    } else {
      const event = receipt.events.filter(
        (e: { event: string }) => e.event === "IrsInstanceDeployed"
      )[0];
      //   console.log(`event: ${JSON.stringify(event, null, 2)}`);
      console.log(`IRS created successfully. Event args were: ${event.args}`);
    }
  } else {
    console.log(
      "No mocks deployed - cannot create IRS instance without more information"
    );
  }
};
func.tags = ["IrsInstance"];
export default func;
