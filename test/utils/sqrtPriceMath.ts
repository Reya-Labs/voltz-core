// uniswap

import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";
import { expect } from "../shared/expect";
import { SqrtPriceMathTest } from "../../typechain/SqrtPriceMathTest";
import {
  encodeSqrtRatioX96,
  expandTo18Decimals,
  TICK_SPACING,
} from "../shared/utilities";
import { TickMathTest } from "../../typechain";
import { toBn } from "evm-bn";

describe("SqrtPriceMath", () => {
  let sqrtPriceMath: SqrtPriceMathTest;
  let tickMath: TickMathTest;

  before(async () => {
    const sqrtPriceMathTestFactory = await ethers.getContractFactory(
      "SqrtPriceMathTest"
    );
    sqrtPriceMath =
      (await sqrtPriceMathTestFactory.deploy()) as SqrtPriceMathTest;

    const tickMathTestFactory = await ethers.getContractFactory("TickMathTest");
    tickMath = (await tickMathTestFactory.deploy()) as TickMathTest;
  });

  describe("#getAmount0Delta", () => {
    it("returns 0 if liquidity is 0", async () => {
      const amount0 = await sqrtPriceMath.getAmount0Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(2, 1).toString(),
        0,
        true
      );

      expect(amount0).to.eq(0);
    });

    it("returns 0 if prices are equal", async () => {
      const amount0 = await sqrtPriceMath.getAmount0Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(1, 1).toString(),
        0,
        true
      );

      expect(amount0).to.eq(0);
    });

    it("returns 0.1 amount1 for price of 1 to 1.21", async () => {
      const amount0 = await sqrtPriceMath.getAmount0Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(121, 100).toString(),
        expandTo18Decimals(1),
        true
      );

      expect(amount0).to.eq("90909090909090910");

      const amount0RoundedDown = await sqrtPriceMath.getAmount0Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(121, 100).toString(),
        expandTo18Decimals(1),
        false
      );

      expect(amount0RoundedDown).to.eq(amount0.sub(1));
    });

    it("works for prices that overflow", async () => {
      const amount0Up = await sqrtPriceMath.getAmount0Delta(
        encodeSqrtRatioX96(BigNumber.from(2).pow(90).toString(), 1).toString(),
        encodeSqrtRatioX96(BigNumber.from(2).pow(96).toString(), 1).toString(),
        expandTo18Decimals(1),
        true
      );
      const amount0Down = await sqrtPriceMath.getAmount0Delta(
        encodeSqrtRatioX96(BigNumber.from(2).pow(90).toString(), 1).toString(),
        encodeSqrtRatioX96(BigNumber.from(2).pow(96).toString(), 1).toString(),
        expandTo18Decimals(1),
        false
      );
      expect(amount0Up).to.eq(amount0Down.add(1));
    });
  });

  describe("#getAmount1Delta", () => {
    it("returns 0 if liquidity is 0", async () => {
      const amount1 = await sqrtPriceMath.getAmount1Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(2, 1).toString(),
        0,
        true
      );

      expect(amount1).to.eq(0);
    });
    it("returns 0 if prices are equal", async () => {
      const amount1 = await sqrtPriceMath.getAmount1Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(1, 1).toString(),
        0,
        true
      );

      expect(amount1).to.eq(0);
    });

    it("returns 0.1 amount1 for price of 1 to 1.21", async () => {
      const amount1 = await sqrtPriceMath.getAmount1Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(121, 100).toString(),
        expandTo18Decimals(1),
        true
      );

      expect(amount1).to.eq("100000000000000000");
      const amount1RoundedDown = await sqrtPriceMath.getAmount1Delta(
        encodeSqrtRatioX96(1, 1).toString(),
        encodeSqrtRatioX96(121, 100).toString(),
        expandTo18Decimals(1),
        false
      );

      expect(amount1RoundedDown).to.eq(amount1.sub(1));
    });
  });

  describe("#getAmountsSequentially", () => {
    it("returns 0 if liquidity is 0", async () => {
      const lowerTick = -TICK_SPACING;
      const currentTick = 0;
      const upperTick = TICK_SPACING;

      const ratioAtLowerTick = await tickMath.getSqrtRatioAtTick(lowerTick);
      const ratioAtCurrentTick = await tickMath.getSqrtRatioAtTick(currentTick);
      const ratioAtUpperTick = await tickMath.getSqrtRatioAtTick(upperTick);
      const liquidityBN = toBn("1000000");

      const fullAmount1 = await sqrtPriceMath.getAmount1Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidityBN,
        false
      );

      const fullAmount0 = await sqrtPriceMath.getAmount0Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidityBN,
        false
      );

      const belowAmount1 = await sqrtPriceMath.getAmount1Delta(
        ratioAtLowerTick,
        ratioAtCurrentTick,
        liquidityBN,
        false
      );

      const belowAmount0 = await sqrtPriceMath.getAmount0Delta(
        ratioAtLowerTick,
        ratioAtCurrentTick,
        liquidityBN,
        false
      );

      let accumulatedAmount0 = toBn("0");
      let accumulatedAmount1 = toBn("0");

      for (let i = lowerTick; i < currentTick; i++) {
        const ratioAtLowerTick = await tickMath.getSqrtRatioAtTick(i);
        const ratioAtUpperTick = await tickMath.getSqrtRatioAtTick(i + 1);

        accumulatedAmount1 = accumulatedAmount1.add(
          await sqrtPriceMath.getAmount1Delta(
            ratioAtLowerTick,
            ratioAtUpperTick,
            liquidityBN,
            false
          )
        );

        accumulatedAmount0 = accumulatedAmount0.add(
          await sqrtPriceMath.getAmount0Delta(
            ratioAtLowerTick,
            ratioAtUpperTick,
            liquidityBN,
            false
          )
        );
      }

      console.log("      below amount 0", utils.formatEther(belowAmount0));
      console.log(
        "accumulated amount 0",
        utils.formatEther(accumulatedAmount0)
      );
      console.log("");
      console.log("      below amount 1", utils.formatEther(belowAmount1));
      console.log(
        "accumulated amount 1",
        utils.formatEther(accumulatedAmount1)
      );
      console.log("");

      expect(belowAmount0).to.be.near(accumulatedAmount0);
      expect(belowAmount1).to.be.near(accumulatedAmount1);

      console.log("full amount 0", utils.formatEther(fullAmount0));
      console.log("full amount 1", utils.formatEther(fullAmount1));
      console.log("");
    });
  });
});
