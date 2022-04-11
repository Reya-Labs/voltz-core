import { task } from "hardhat/config";
import { MarginEngine, VAMM } from "../typechain";
import { getConfigDefaults } from "../deployConfig/config";

task("setParameters", "Sets Parameters in a given pool to defaults").setAction(
  async (_, hre) => {
    // todo: make settable in the createIrsInstance task
    const marginEngineAddress = "0xdcf2d0e379c29f67df42f6b720591ae66da48e3c";
    const vammAddress = "0x85eef2c55a58bc5d0d31ed97719771a9967b5ac1";

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      marginEngineAddress
    )) as MarginEngine;

    const vamm = (await hre.ethers.getContractAt("VAMM", vammAddress)) as VAMM;

    const configDefaults = getConfigDefaults(hre.network.name);
    let trx = await marginEngine.setMarginCalculatorParameters(
      configDefaults.marginEngineCalculatorParameters
    );

    await trx.wait();

    trx = await marginEngine.setCacheMaxAgeInSeconds(
      configDefaults.marginEngineCacheMaxAgeInSeconds
    );
    await trx.wait();

    trx = await marginEngine.setLookbackWindowInSeconds(
      configDefaults.marginEngineLookbackWindowInSeconds
    );
    await trx.wait();

    trx = await marginEngine.setLiquidatorReward(
      configDefaults.marginEngineLiquidatorRewardWad
    );
    await trx.wait();

    trx = await vamm.setFeeProtocol(configDefaults.vammFeeProtocol);
    await trx.wait();

    trx = await vamm.setFee(configDefaults.vammFeeWad);
    await trx.wait();
  }
);

module.exports = {};
