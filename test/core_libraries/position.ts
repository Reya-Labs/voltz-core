// hybrid of uniswap + new
import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { PositionTest } from "../../typechain/PositionTest";
import { toBn } from "../helpers/toBn";
import { calculateFixedAndVariableDelta } from "../shared/utilities";

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
      expect(positionLiquidityUpdated[0]).to.eq(90);
    });
  });

  describe("#updateMargin", () => {
    it("correctly updates the margin of a position", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateMargin(toBn("10"));
      await positionTest.updateMargin(toBn("-1"));
      const positionMarginUpdated = await positionTest.position();
      expect(positionMarginUpdated[1]).to.eq(toBn("9"));
    });
  });

  describe("#updateBalances", () => {
    it("correctly updates the variable and fixed token balances of a position", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateBalances(toBn("1000"), toBn("-2000"));
      await positionTest.updateBalances(toBn("2000"), toBn("-3000"));
      const positionBalancesUpdated = await positionTest.position();
      expect(positionBalancesUpdated[4]).to.eq(toBn("3000"));
      expect(positionBalancesUpdated[5]).to.eq(toBn("-5000"));
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
    it("check the inside last balances are correctly updated", async () => {
      const { positionTest } = await loadFixture(fixture);
      await positionTest.updateLiquidity(10);
      const updatedPosition = await positionTest.position();

      expect(updatedPosition._liquidity, "1").to.eq(10);

      console.log(
        "last fixed:",
        (await positionTest.getFixedTokenGrowthInsideLastX128()).toString()
      );
      console.log(
        "last variable:",
        (await positionTest.getVariableTokenGrowthInsideLastX128()).toString()
      );

      const result = await positionTest.calculateFixedAndVariableDelta(
        toBn("20"),
        toBn("-30")
      );

      await positionTest.updateFixedAndVariableTokenGrowthInside(
        toBn("20"),
        toBn("-30")
      );

      console.log(
        "last fixed:",
        (await positionTest.getFixedTokenGrowthInsideLastX128()).toString()
      );
      console.log(
        "last variable:",
        (await positionTest.getVariableTokenGrowthInsideLastX128()).toString()
      );

      console.log("result: ", result.toString());

      const expectedResult = calculateFixedAndVariableDelta(
        toBn("20"),
        toBn("-30"),
        toBn("0"),
        toBn("0"),
        BigNumber.from(10)
      );

      expect(result[0], "2").to.eq(expectedResult[0]);
      expect(result[1], "3").to.eq(expectedResult[1]);

      
    });
  });

  describe("#calculateFeeDelta", () => {
    it("check fails when liquidity zero", async () => {
      const { positionTest } = await loadFixture(fixture);
      return expect(
        positionTest.calculateFeeDelta(toBn("50"))
      ).to.be.revertedWith("NP");
    });

    it("test when feeGrowthInsideLast = 0", async () => {
      const { positionTest } = await loadFixture(fixture);
      const lastFeeGrowthInside = 0;
      const feeGrowthInside = 50;
      const liquidity = 10;
      await positionTest.updateLiquidity(liquidity);
      const result = await positionTest.calculateFeeDelta(
        toBn(feeGrowthInside)
      );
      console.log("result", result);
      expect(result).to.eq(
        toBn((feeGrowthInside - lastFeeGrowthInside) * liquidity)
      );
    });
  });
});
