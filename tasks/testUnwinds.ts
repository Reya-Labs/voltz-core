/* eslint-disable no-unneeded-ternary */
import "@nomiclabs/hardhat-ethers";

import { task } from "hardhat/config";
import { getConfig } from "../deployConfig/config";
import { getSigner } from "./utils/getSigner";
import { MarginEngine, VAMM } from "../typechain";
import { BigNumber, utils } from "ethers";
import { MAX_SQRT_RATIO, MIN_SQRT_RATIO } from "../test/shared/utilities";

task("testUnwinds", "Test soft unwinds")
  .addOptionalParam("underlyingNetwork", "The underlying network of the fork")
  .setAction(async (taskArgs, hre) => {
    // 0. Task setup & Upgrade margin engine contract to old implementation
    // Owner: 0x03d15ec11110dda27df907e12e7ac996841d95e4
    // Tick range: -69060 -> 0
    // Fixed tokens: -338991.2573, Variable tokens: 70000.0000
    const network: string = taskArgs.underlyingNetwork || hre.network.name;
    const user = "0x03d15ec11110dda27df907e12e7ac996841d95e4";
    const userSigner = await getSigner(hre, user);
    const tickLower = -69060;
    const tickUpper = 0;

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      "0x0ca700b946c446d878a497c50fb98844a85a2dd9"
    )) as MarginEngine;

    const vamm = (await hre.ethers.getContractAt(
      "VAMM",
      "0x1d7e4d7c1629c9d6e3bb6a344496b1b782c9ca9a"
    )) as VAMM;

    {
      const deployConfig = getConfig(network);
      const multisig = deployConfig.multisig;
      const multisigSigner = await getSigner(hre, multisig);

      // upgrade margin engine
      const marginEngineFactory = await hre.ethers.getContractFactory(
        "MarginEngine"
      );
      const newMarginEngineImplementation =
        (await marginEngineFactory.deploy()) as MarginEngine;
      await marginEngine
        .connect(multisigSigner)
        .upgradeTo(newMarginEngineImplementation.address);

      // upgrade vamm
      const vammFactory = await hre.ethers.getContractFactory("VAMM");
      const newVAMMImplementation = (await vammFactory.deploy()) as VAMM;
      await vamm
        .connect(multisigSigner)
        .upgradeTo(newVAMMImplementation.address);
    }

    // 1. Make sure user cannot create a new swap in the same direction
    try {
      await vamm.connect(userSigner).swap({
        recipient: user,
        amountSpecified: utils.parseUnits("-1", 6), //  VT trade
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      console.log(
        "Bad, user was able to create a new swap in the same direction"
      );
    } catch (e) {
      console.log(
        "Good, user was not able to create a new swap in the same direction"
      );
    }

    // 2. Make sure user cannot create a new swap in the other direction (unwind + new swap)
    try {
      await vamm.connect(userSigner).swap({
        recipient: user,
        amountSpecified: utils.parseUnits("70001", 6), // FT trade
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      console.log(
        "Bad, user was able to create a new swap in the opposite direction (unwind + new swap)"
      );
    } catch (e) {
      console.log(
        "Good, user was not able to create a new swap in the opposite direction (unwind + new swap)"
      );
    }

    // 3. Make sure user can unwind part of their position
    try {
      await vamm.connect(userSigner).swap({
        recipient: user,
        amountSpecified: utils.parseUnits("50000", 6), // FT trade
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      console.log("Good, user was able to unwind part of their position");
    } catch (e) {
      console.log("Bad, user was not able to unwind part of their position");
    }

    // 4. Make sure user can unwind rest of their position
    try {
      await vamm.connect(userSigner).swap({
        recipient: user,
        amountSpecified: utils.parseUnits("20000", 6), // FT trade
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      console.log("Good, user was able to unwind rest of their position");
    } catch (e) {
      console.log("Bad, user was not able to unwind rest of their position");
    }

    // 5. Make sure user cannot create a new VT swap
    try {
      await vamm.connect(userSigner).swap({
        recipient: user,
        amountSpecified: utils.parseUnits("-1", 6), // VT trade
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      console.log("Bad, user was able to create a new VT swap");
    } catch (e) {
      console.log("Good, user was not able to create a new VT swap");
    }

    // 6. Make sure user cannot create a new FT swap
    try {
      await vamm.connect(userSigner).swap({
        recipient: user,
        amountSpecified: utils.parseUnits("1", 6), // FT trade
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: tickLower,
        tickUpper: tickUpper,
      });

      console.log("Bad, user was able to create a new FT swap");
    } catch (e) {
      console.log("Good, user was not able to create a new FT swap");
    }
  });
