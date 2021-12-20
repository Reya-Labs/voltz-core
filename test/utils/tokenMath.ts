// uniswap

import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { TokenMathTest } from "../../typechain/TokenMathTest";
import { expandToDecimals } from "../shared/utilities";

describe("TokenMathTest", () => {
  let tokenMath: TokenMathTest;

  before(async () => {
    const tokenMathFactory = await ethers.getContractFactory("TokenMathTest");
    tokenMath = (await tokenMathFactory.deploy()) as TokenMathTest;
  });

  describe("#toBase", () => {
    it("returns the base value for a given amount", async () => {
      const tests = [
        [100, 18],
        [1445, 14],
        [10000, 18],
      ];

      tests.forEach(async (test) =>
        expect(await tokenMath.toBase(test[0], test[1])).to.equal(
          expandToDecimals(test[0], test[1])
        )
      );
    });

    it("reverts on overflow", async () => {
      await expect(tokenMath.toBase(10000000000000000000, 10000000)).to.be
        .reverted;
    });
  });

  describe("#toAmount", () => {
    it("returns the amount value for a given base", async () => {
      const tests = [
        [10000000000, 18],
        [14450000000, 14],
        [10000000000, 12],
        [10000000000, 1],
      ];

      tests.forEach(async (test) =>
        expect(await tokenMath.toAmount(test[0], test[1])).to.equal(
          BigNumber.from(test[0]).div(BigNumber.from(10).pow(test[1]))
        )
      );
    });
  });
});
