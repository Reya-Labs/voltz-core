import { BigNumber, utils } from "ethers";
import { task } from "hardhat/config";
import { MarginEngine } from "../typechain";

task(
  "updatePositionMargin",
  "Updates position margin"
)
  .addParam(
    "meaddress",
    "Margin Engine Address"
  )
  .addParam(
    "owner",
    "Address of the owner of the position"
  )
  .addParam(
    "ticklower",
    "Lower tick of a position"
  )
  .addParam(
    "tickupper",
    "Upper tick of a position"
  )
  .addParam(
    "margindelta",
    "Amount of margin to deposit/withdraw depending on the sign of margin delta"
  )
  .setAction(async (taskArgs, hre) => {

    const marginDelta = BigNumber.from(taskArgs.margindelta);
    const owner = utils.getAddress(taskArgs.owner)
    const marginEngineAddress = taskArgs.meaddress;
    const tickLower = taskArgs.ticklower
    const tickUpper = taskArgs.tickUpper

    const marginEngine = await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
    ) as MarginEngine;

    await marginEngine.updatePositionMargin(owner, tickLower, tickUpper, marginDelta);

  });

module.exports = {};
