import { task } from "hardhat/config";
import { MarginEngine } from "../typechain";
import { getConfigDefaults } from "../deployConfig/config";

task(
  "setMarginCalculatorParameters",
  "Sets Margin Calculator Parameters"
).setAction(async (_, hre) => {
  // todo: make settable in the createIrsInstance task
  const marginEngineAddress = "0xdcf2d0e379c29f67df42f6b720591ae66da48e3c";

  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  const configDefaults = getConfigDefaults(hre.network.name);
  const trx = await marginEngine.setMarginCalculatorParameters(
    configDefaults.marginEngineCalculatorParameters
  );

  await trx.wait();
});

module.exports = {};
