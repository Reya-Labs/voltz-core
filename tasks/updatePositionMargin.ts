import { utils } from "ethers";
import { task } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { ERC20Mock, MarginEngine } from "../typechain";

task("updatePositionMargin", "Updates position margin")
  .addParam("meaddress", "Margin Engine Address")
  .addParam("owner", "Address of the owner of the position")
  .addParam("ticklower", "Lower tick of a position")
  .addParam("tickupper", "Upper tick of a position")
  .addParam(
    "margindelta",
    "Amount of margin to deposit/withdraw depending on the sign of margin delta"
  )
  .setAction(async (taskArgs, hre) => {
    const marginDelta = toBn(taskArgs.margindelta);
    const owner = utils.getAddress(taskArgs.owner);
    const marginEngineAddress = taskArgs.meaddress;
    const tickLower = parseInt(taskArgs.ticklower);
    const tickUpper = parseInt(taskArgs.tickupper);

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      marginEngineAddress
    )) as MarginEngine;

    // approve the me

    // get the token address
    const tokenAddress: string = await marginEngine.underlyingToken();

    const token = (await hre.ethers.getContractAt(
      "ERC20Mock",
      tokenAddress
    )) as ERC20Mock;

    await token.approve(marginEngine.address, marginDelta);

    await marginEngine.updatePositionMargin(
      owner,
      tickLower,
      tickUpper,
      marginDelta
    );
  });

module.exports = {};
