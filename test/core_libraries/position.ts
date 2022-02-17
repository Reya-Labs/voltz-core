// hybrid of uniswap + new
import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { PositionTest } from "../../typechain/PositionTest";
import { toBn } from "../helpers/toBn";

const { loadFixture } = waffle;

interface PostitionTestFixture {
  positionTest: PositionTest;
}

describe("Position", () => {
  async function fixture(): Promise<PostitionTestFixture> {
    const positionTestFactory = await ethers.getContractFactory("PositionTest");
    const positionTest = (await positionTestFactory.deploy()) as PositionTest;
    return { positionTest };
  }

  describe("#updateLiquidity", () => {
    it("reverts if liquidity delta is zero", async () => {
      const { positionTest } = await loadFixture(fixture);
      const positionLiquidity = await positionTest.position();
      expect(positionLiquidity._liquidity).to.eq(0);
      return expect(positionTest.updateLiquidity(0)).to.be.revertedWith("NP");
    });

    it("correctly updates the liqudity of a position", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateLiquidity(100);
      await positionTest.updateLiquidity(0);
      await positionTest.updateLiquidity(-10);
      const positionLiquidityUpdated = await positionTest.position();
      expect(positionLiquidityUpdated._liquidity).to.eq(90);
    });
  });

  describe("#updateMargin", () => {
    it("correctly updates the margin of a position", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateMargin(toBn("10"));
      await positionTest.updateMargin(toBn("-1"));
      const positionMarginUpdated = await positionTest.position();
      expect(positionMarginUpdated.margin).to.eq(toBn("9"));
    });
  });

  describe("#updateBalances", () => {
    it("correctly updates the variable and fixed token balances of a position", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateBalances(toBn("1000"), toBn("-2000"));
      await positionTest.updateBalances(toBn("2000"), toBn("-3000"));
      const positionBalancesUpdated = await positionTest.position();
      expect(positionBalancesUpdated.fixedTokenBalance).to.eq(toBn("3000"));
      expect(positionBalancesUpdated.variableTokenBalance).to.eq(toBn("-5000"));
    });
  });

  describe("#updateFixedAndVariableTokenGrowthInside", () => {
    it("check the inside last balances are correctly updated", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateLiquidity(100);
      await positionTest.updateFixedAndVariableTokenGrowthInside(
        toBn("20"),
        toBn("-30")
      );

      const positionUpdated = await positionTest.position();

      expect(positionUpdated.fixedTokenGrowthInsideLastX128).to.eq(toBn(20));
      expect(positionUpdated.variableTokenGrowthInsideLastX128).to.eq(
        toBn(-30)
      );
    });
  });

  describe("#feeGrowthInside", () => {
    it("check feeGrowthInsideLast correctly updated", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateFeeGrowthInside(toBn("21"));
      const positionUpdated = await positionTest.position();
      expect(positionUpdated.feeGrowthInsideLastX128).to.eq(toBn("21"));
    });
  });

  describe("#calculateFixedAndVariableDelta", () => {
    it("check fixed and variable deltas are correctly calculated", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateLiquidity(10);
      const updatedPosition = await positionTest.position();

      expect(updatedPosition._liquidity).to.eq(10);

      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      // console.log(Q128); // 1 in Q128
      // console.log(Q128Negative); // -1 in Q128

      const result = await positionTest.calculateFixedAndVariableDelta(
        Q128,
        Q128Negative
      );

      expect(result[0]).to.eq(10);
      expect(result[1]).to.eq(-10);
    });
  });

  describe("#calculateFeeDelta", () => {
    it("check fee delta correctly calculated", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateLiquidity(10);
      const updatedPosition = await positionTest.position();

      expect(updatedPosition._liquidity).to.eq(10);

      const Q128 = BigNumber.from(2).pow(128);

      const result = await positionTest.calculateFeeDelta(Q128);

      expect(result).to.eq(10);
    });
  });
});
