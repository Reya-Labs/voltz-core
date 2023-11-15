/* eslint-disable no-unneeded-ternary */
import "@nomiclabs/hardhat-ethers";

import { task } from "hardhat/config";
import { getConfig } from "../deployConfig/config";
import { getSigner } from "./utils/getSigner";
import { IERC20Minimal, MarginEngine } from "../typechain";
import { utils } from "ethers";

task("testGlpUpgrade", "Test glp upgrade")
  .addOptionalParam("underlyingNetwork", "The underlying network of the fork")
  .setAction(async (taskArgs, hre) => {
    // 0. Task setup & Upgrade margin engine contract to old implementation
    const network: string = taskArgs.underlyingNetwork || hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;
    const multisigSigner = await getSigner(hre, multisig);
    const tickLower = -32220;
    const tickUpper = -16080;

    const weth = (await hre.ethers.getContractAt(
      "IERC20Minimal",
      "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
    )) as IERC20Minimal;

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      "0xbe958ba49be73d3020cb62e512619da953a2bab1"
    )) as MarginEngine;

    await marginEngine
      .connect(multisigSigner)
      .upgradeTo("0xbe74538cba79fc440f8809e01b36c97AFBda23Ce");

    // 1. Make sure multisig cannot withdraw settlement amount before settling the position
    try {
      await marginEngine
        .connect(multisigSigner)
        .updatePositionMargin(
          multisig,
          tickLower,
          tickUpper,
          utils.parseEther("-49.39")
        );
      console.log("Bad, Multisig was able to withdraw before settling");
    } catch (e) {
      console.log("Good, Multisig was not able to withdraw before settling");
    }

    // 2. Settle position
    await marginEngine
      .connect(multisigSigner)
      .settlePosition(multisig, tickLower, tickUpper);

    // 3. Make sure multisig cannot withdraw more than its margin
    try {
      await marginEngine
        .connect(multisigSigner)
        .updatePositionMargin(
          multisig,
          tickLower,
          tickUpper,
          utils.parseEther("-49.4")
        );
      console.log("Bad, Multisig was able to withdraw more than its balance");
    } catch (e) {
      console.log(
        "Good, Multisig was not able to withdraw more than its balance"
      );
    }

    // 4. Make sure multisig can withdraw its margin
    const multisigBalanceBefore = await weth.balanceOf(multisig);
    await marginEngine
      .connect(multisigSigner)
      .updatePositionMargin(
        multisig,
        tickLower,
        tickUpper,
        utils.parseEther("-49.39")
      );
    const multisigBalanceAfter = await weth.balanceOf(multisig);

    console.log(
      `Multisig successfully withdrew ${utils.formatEther(
        multisigBalanceAfter.sub(multisigBalanceBefore)
      )}`
    );

    // 5. Settle inexistent position, as implementation allows it (but margin will be 0)
    await marginEngine
      .connect(multisigSigner)
      .settlePosition(multisig, -60, 60);

    // 6. Make sure multisig cannot withdraw from settled inexistent position
    try {
      await marginEngine
        .connect(multisigSigner)
        .updatePositionMargin(multisig, -60, 60, utils.parseEther("-0.00001"));
      console.log(
        "Bad, Multisig was able to withdraw from settled inexistent position"
      );
    } catch (e) {
      console.log(
        "Good, multisig was not able to withdraw from settled inexistent position"
      );
    }
  });
