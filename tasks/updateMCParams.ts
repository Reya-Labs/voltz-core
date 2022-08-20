import "@nomiclabs/hardhat-ethers";
import { BigNumberish } from "ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { poolConfig, poolConfigs } from "../deployConfig/poolConfig";
import { IMarginEngine } from "../typechain";

interface MultisigTemplateData {
  marginEngineAddress: string;
  liquidatorReward: BigNumberish;
  marginCalculatorParams: {
    apyUpperMultiplierWad: BigNumberish;
    apyLowerMultiplierWad: BigNumberish;
    sigmaSquaredWad: BigNumberish;
    alphaWad: BigNumberish;
    betaWad: BigNumberish;
    xiUpperWad: BigNumberish;
    xiLowerWad: BigNumberish;
    tMaxWad: BigNumberish;
    etaIMWad: BigNumberish;
    etaLMWad: BigNumberish;
    gammaWad: BigNumberish;
    minMarginToIncentiviseLiquidators: BigNumberish;
  };
}

async function writeUpdateMCParamsTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "updateMCParams.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  console.log("Output:\n", output);
}

task("updateMCParams", "Updates the MC Parameters of a pool")
  .addParam("pool", "The name of the pool (e.g. 'aDAI', 'stETH', etc.)")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addParam(
    "marginEngineAddress",
    "The address of the margin engine we want to update MC parameters"
  )
  .setAction(async (taskArgs, hre) => {
    let poolConfig: poolConfig;
    if (taskArgs.pool in poolConfigs) {
      poolConfig = poolConfigs[taskArgs.pool];
    } else {
      throw new Error(`No configuration for ${taskArgs.pool}.`);
    }

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as IMarginEngine;

    if (taskArgs.multisig) {
      const data: MultisigTemplateData = {
        marginEngineAddress: marginEngine.address,
        liquidatorReward: poolConfig.liquidatorRewardWad,
        marginCalculatorParams: poolConfig.marginCalculatorParams,
      };

      await writeUpdateMCParamsTransactionsToGnosisSafeTemplate(data);
    } else {
      {
        console.log("Setting margin calculator parameters...");
        const tx = await marginEngine.setMarginCalculatorParameters(
          poolConfig.marginCalculatorParams
        );
        await tx.wait();
      }

      {
        console.log("Setting liquidator reward...");
        const tx = await marginEngine.setLiquidatorReward(
          poolConfig.liquidatorRewardWad
        );
        await tx.wait();
      }

      console.log("Done.");
    }
  });
