/* eslint-disable no-unneeded-ternary */
import "@nomiclabs/hardhat-ethers";
import { BigNumberish } from "ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { getConfig } from "../deployConfig/config";
import { getPool } from "../poolConfigs/pool-addresses/pools";
import { getPoolConfig } from "../poolConfigs/pool-configs/poolConfig";
import { getSigner } from "./utils/getSigner";
import { IMarginEngine } from "../typechain";

interface SingleUpdateTemplateData {
  marginEngineAddress: string;

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

interface MultisigTemplateData {
  factoryAddress: string;
  multisig: string;
  chainId: string;

  pools: SingleUpdateTemplateData[];
}

function writeGnosisSafeTemplate(data: MultisigTemplateData) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "templates/updateMarginEngines.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  fs.writeFileSync(
    path.join(__dirname, "JSONs/updateMarginEngines.json"),
    output,
    () => {}
  );
}

// Description:
//   This task generates multisig txs to update configuration of margin engine.
//     - First, you need to update the configuration in './poolConfigs/pool-configs/poolConfig.ts'
//   for the corresponding pools
//     - Then, run this task with the flags set depending what parameters you like to update
//
// Example:
//   ``npx hardhat updateMarginEngines --network mainnet aUSDC_v11 aDAI_v4 --liq-rew --mc-params --lb-win``

task("updateMarginEngines", "It updates the configurations of given pools")
  .addVariadicPositionalParam("pools", "Space-separated pool names")
  .addFlag("liqRew") // liquidator reward update flag
  .addFlag("mcParams") // margin calculator parameters update flag
  .addFlag("lbWin") // lookback window update flag
  .addFlag("multisig") // generate json
  .addOptionalParam("underlyingNetwork", "The underlying network of the fork")
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;

    // Fetch factory
    const factory = await hre.ethers.getContract("Factory");

    // Retrieve multisig address for the current network
    const network: string = taskArgs.underlyingNetwork || hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Initialize the data keeper
    const data: MultisigTemplateData = {
      pools: [],
      factoryAddress: factory.address,
      multisig: multisig,
      chainId: await hre.getChainId(),
    };

    for (const pool of poolNames) {
      const poolConfig = getPoolConfig(network, pool);
      const poolDetails = getPool(network, pool);

      const singleData: SingleUpdateTemplateData = {
        marginEngineAddress: poolDetails.marginEngine,

        updateLiquidatorReward: taskArgs.liqRew ? true : false,
        liquidatorReward: poolConfig.liquidatorRewardWad,

        updateMarginCalculatorParams: taskArgs.mcParams ? true : false,
        marginCalculatorParams: poolConfig.marginCalculatorParams,

        updateLookbackWindow: taskArgs.lbWin ? true : false,
        lookbackWindowInSeconds: poolConfig.lookbackWindowInSeconds,
      };

      data.pools.push(singleData);
    }

    if (taskArgs.multisig) {
      writeGnosisSafeTemplate(data);
    } else {
      const multisigSigner = await getSigner(hre, data.multisig);
      for (const pool of data.pools) {
        const marginEngine = (await hre.ethers.getContractAt(
          "MarginEngine",
          pool.marginEngineAddress
        )) as IMarginEngine;

        if (pool.updateMarginCalculatorParams) {
          await marginEngine
            .connect(multisigSigner)
            .setMarginCalculatorParameters(pool.marginCalculatorParams);
        }

        if (pool.updateLiquidatorReward) {
          await marginEngine
            .connect(multisigSigner)
            .setLiquidatorReward(pool.liquidatorReward);
        }

        if (pool.updateLookbackWindow) {
          await marginEngine
            .connect(multisigSigner)
            .setLookbackWindowInSeconds(pool.lookbackWindowInSeconds);
        }
      }
    }
  });
