/* eslint-disable no-unneeded-ternary */
import "@nomiclabs/hardhat-ethers";
import { BigNumberish } from "ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { poolConfig, poolConfigs } from "../deployConfig/poolConfig";
import * as poolAddresses from "../pool-addresses/mainnet.json";

interface MultisigTemplateData {
  marginEngineAddress: string;

  upgradeMarginEngine: boolean;
  newImplementation: string;

  updateLiquidatorReward: boolean;
  liquidatorReward: BigNumberish;

  updateMarginCalculatorParams: boolean;
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
    gap1: BigNumberish;
    gap2: BigNumberish;
    gap3: BigNumberish;
    gap4: BigNumberish;
    gap5: BigNumberish;
    gap6: BigNumberish;
    gap7: BigNumberish;
    minMarginToIncentiviseLiquidators: BigNumberish;
  };

  updateLookbackWindow: boolean;
  lookbackWindowInSeconds: BigNumberish;
}

async function writeGnosisSafeTemplate(data: {
  pools: MultisigTemplateData[];
}) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "updateMarginEngines.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  fs.writeFileSync(
    path.join(__dirname, "JSONs/updateMarginEngines.json"),
    output,
    () => {}
  );
}

task("updateMarginEngines", "Updates the MC Parameters of a pool")
  .addParam("pools", "The name of the pool (e.g. 'aDAI_v2', 'stETH_v1', etc.)")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addFlag("upgradeMarginEngine")
  .addFlag("updateLiquidatorReward")
  .addFlag("updateMarginCalculatorParams")
  .addFlag("updateLookbackWindow")
  .setAction(async (taskArgs, _) => {
    const poolNames = taskArgs.pools.split(",");

    const updates: {
      pools: MultisigTemplateData[];
    } = {
      pools: [],
    };

    for (const pool of poolNames) {
      let poolConfig: poolConfig;
      let poolInfo: {
        marginEngine: string;
        decimals: number;
        deploymentBlock: number;
      };

      if (pool in poolConfigs) {
        poolConfig = poolConfigs[pool];
        poolInfo = poolAddresses[pool as keyof typeof poolAddresses];
      } else {
        throw new Error(`No configuration for ${pool}.`);
      }

      const data: MultisigTemplateData = {
        marginEngineAddress: poolInfo.marginEngine,

        upgradeMarginEngine: taskArgs.upgradeMarginEngine ? true : false,
        newImplementation: "0x2457D958DBEBaCc9daA41B47592faCA5845f8Fc3",

        updateLiquidatorReward: taskArgs.updateLiquidatorReward ? true : false,
        liquidatorReward: poolConfig.liquidatorRewardWad,

        updateMarginCalculatorParams: taskArgs.updateMarginCalculatorParams
          ? true
          : false,
        marginCalculatorParams: poolConfig.marginCalculatorParams,

        updateLookbackWindow: taskArgs.updateLookbackWindow ? true : false,
        lookbackWindowInSeconds: poolConfig.lookbackWindowInSeconds,
      };

      updates.pools.push(data);
    }

    if (taskArgs.multisig) {
      console.log(updates);
      await writeGnosisSafeTemplate(updates);
    } else {
      throw new Error("Non-multisig is not implemented yet.");
    }
  });
