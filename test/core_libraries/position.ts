// hybrid of uniswap + new
import { BigNumber, constants } from "ethers";
import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { PositionTest } from "../../typechain/PositionTest";
import { encodeSqrtRatioX96, expandTo18Decimals } from "../shared/utilities";
import { toBn } from "evm-bn";
import { div, sub, mul, add } from "../shared/functions";
import { createSnapshot, restoreSnapshot } from "../helpers/snapshots";

const { provider } = waffle;

function calculateFixedAndVariableDelta(
  fixedTokenGrowthInside: BigNumber,
  variableTokenGrowthInside: BigNumber,
  fixedTokenGrowthInsideLast: BigNumber,
  variableTokenGrowthInsideLast: BigNumber,
  liquidity: BigNumber
) {
  const fixedTokenBalance: BigNumber = mul(
    sub(fixedTokenGrowthInside, fixedTokenGrowthInsideLast),
    liquidity
  );
  const variableTokenBalance: BigNumber = mul(
    sub(variableTokenGrowthInside, variableTokenGrowthInsideLast),
    liquidity
  );

  return [fixedTokenBalance, variableTokenBalance];
}

describe("Position", () => {
  let positionTest: PositionTest;
  let snapshotId: number;

  before(async () => {
    const positionTestFactory = await ethers.getContractFactory("PositionTest");
    positionTest = (await positionTestFactory.deploy()) as PositionTest;
    snapshotId = await createSnapshot(provider);
  });

  afterEach(async () => {
    // revert back to initial state after each test
    await restoreSnapshot(provider, snapshotId);
  });

  describe("#updateLiquidity", () => {
    it("reverts if liquidity delta is zero", async () => {
      const positionLiquidity = await positionTest.position();
      expect(positionLiquidity._liquidity).to.eq(0);
      return expect(positionTest.updateLiquidity(0)).to.be.revertedWith("NP");
    });

    it("correctly updates the liqudity of a position", async () => {
      await positionTest.updateLiquidity(100);
      await positionTest.updateLiquidity(0);
      await positionTest.updateLiquidity(-10);
      const positionLiquidityUpdated = await positionTest.position();
      expect(positionLiquidityUpdated[0]).to.eq(90);
    });
  });

  describe("#updateMargin", () => {
    it("correctly updates the margin of a position", async () => {
      await positionTest.updateMargin(toBn("10"));
      await positionTest.updateMargin(toBn("-1"));
      const positionMarginUpdated = await positionTest.position();
      expect(positionMarginUpdated[1]).to.eq(toBn("9"));
    });
  });

  describe("#updateBalances", () => {
    it("correctly updates the variable and fixed token balances of a position", async () => {
      await positionTest.updateBalances(toBn("1000"), toBn("-2000"));

      await positionTest.updateBalances(toBn("2000"), toBn("-3000"));

      const positionBalancesUpdated = await positionTest.position();

      expect(positionBalancesUpdated[4]).to.eq(toBn("3000"));
      expect(positionBalancesUpdated[5]).to.eq(toBn("-5000"));
    });
  });

  describe("#updateFixedAndVariableTokenGrowthInside", () => {
    it("check the inside last balances are correctly updated", async () => {
      await positionTest.updateLiquidity(100);

      await positionTest.updateFixedAndVariableTokenGrowthInside(
        toBn("20"),
        toBn("-30")
      );

      const positionUpdated = await positionTest.position();

      expect(positionUpdated.fixedTokenGrowthInsideLast).to.eq(toBn("20"));
      expect(positionUpdated.variableTokenGrowthInsideLast).to.eq(toBn("-30"));
    });
  });

  describe("#feeGrowthInside", () => {
    it("check feeGrowthInsideLast correctly updated", async () => {
      await positionTest.updateFeeGrowthInside(toBn("21"));
      const positionUpdated = await positionTest.position();
      expect(positionUpdated.feeGrowthInsideLast).to.eq(toBn("21"));
    });
  });

  describe("#calculateFixedAndVariableDelta", () => {
    before(async () => {
      await createSnapshot(provider);
      const positionTestFactory = await ethers.getContractFactory(
        "PositionTest"
      );

      positionTest = (await positionTestFactory.deploy()) as PositionTest;
    });

    after(async () => {
      // revert back to initial state after all tests pass
      await restoreSnapshot(provider);
    });

    it("check the inside last balances are correctly updated", async () => {
      await positionTest.updateLiquidity(10);
      const updatedPosition = await positionTest.position();

      expect(updatedPosition._liquidity).to.eq(10);

      const result = await positionTest.calculateFixedAndVariableDelta(
        toBn("20"),
        toBn("-30")
      );

      const expectedResult = calculateFixedAndVariableDelta(
        toBn("20"),
        toBn("-30"),
        toBn("0"),
        toBn("0"),
        toBn("10")
      );

      expect(result[0]).to.eq(expectedResult[0]);
      expect(result[1]).to.eq(expectedResult[1]);

      await positionTest.updateFixedAndVariableTokenGrowthInside(
        toBn("20"),
        toBn("-30")
      );
    });
  });
});
