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
import { IVAMM } from "../typechain";
import { toBn } from "../test/helpers/toBn";

interface SingleUpdateTemplateData {
  vammAddress: string;

  updateMaturityBuffer: boolean;
  maturityBufferWad: BigNumberish;

  updateFeeProtocol: boolean;
  feeProtocol: BigNumberish;

  updateFee: boolean;
  fee: BigNumberish;
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
    path.join(__dirname, "templates/updateVamms.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  fs.writeFileSync(
    path.join(__dirname, "JSONs/updateVamms.json"),
    output,
    () => {}
  );
}

// Description:
//   This task generates multisig txs to update configuration of vamm.
//     - First, you need to update the configuration in './poolConfigs/pool-configs/poolConfig.ts'
//   for the corresponding pools
//     - Then, run this task with the flags set depending what parameters you like to update
//
// Example:
//   ``npx hardhat updateVamms --network mainnet aUSDC_v11 aDAI_v4 --maturity-buffer --fee-protocol --fee``

task("updateVamms", "It updates the configurations of given pools")
  .addVariadicPositionalParam("pools", "Space-separated pool names")
  .addFlag("maturityBuffer")
  .addFlag("feeProtocol")
  .addFlag("fee")
  .addFlag("multisig")
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
        vammAddress: poolDetails.vamm,

        updateMaturityBuffer: taskArgs.maturityBuffer ? true : false,
        maturityBufferWad: toBn(poolConfig.maturityBuffer),

        updateFeeProtocol: taskArgs.feeProtocol ? true : false,
        feeProtocol: poolConfig.vammFeeProtocol,

        updateFee: taskArgs.fee ? true : false,
        fee: poolConfig.feeWad,
      };

      data.pools.push(singleData);
    }

    if (taskArgs.multisig) {
      writeGnosisSafeTemplate(data);
    } else {
      const multisigSigner = await getSigner(hre, data.multisig);
      for (const pool of data.pools) {
        const vamm = (await hre.ethers.getContractAt(
          "VAMM",
          pool.vammAddress
        )) as IVAMM;

        if (pool.updateMaturityBuffer) {
          await vamm
            .connect(multisigSigner)
            .setMaturityBuffer(pool.maturityBufferWad);
        }

        if (pool.updateFeeProtocol) {
          await vamm.connect(multisigSigner).setFeeProtocol(pool.feeProtocol);
        }

        if (pool.updateFee) {
          await vamm.connect(multisigSigner).setFee(pool.fee);
        }
      }
    }
  });
