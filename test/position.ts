import { BigNumber, constants } from "ethers";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { PositionTest } from "../typechain/PositionTest";
import { Position } from "../typechain/Position";
import { encodeSqrtRatioX96, expandTo18Decimals } from "./shared/utilities";
import { toBn } from "evm-bn";
import { div, sub, mul, add } from "./shared/functions";

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
  let position: Position;

  before(async () => {
    const positionFactory = await ethers.getContractFactory("Position");

    const position = (await positionFactory.deploy()) as Position;

    const positionTestFactory = await ethers.getContractFactory(
      "PositionTest",
      {
        libraries: {
          Position: position.address,
        },
      }
    );

    positionTest = (await positionTestFactory.deploy()) as PositionTest;
  });

  describe("#updateLiquidity", () => {
    before(async () => {
      // const positionLiquidity = await positionTest.position()
      // expect(positionLiquidity[0]).to.eq(0)
    });

    it("correctly updates the liqudity of a position", async () => {
      await positionTest.updateLiquidity(100);

      await positionTest.updateLiquidity(-10);

      const positionLiquidityUpdated = await positionTest.position();

      expect(positionLiquidityUpdated[0]).to.eq(90);
    });

    it("reverts if liquidity delta is zero", async () => {
      expect(positionTest.updateLiquidity(0)).to.be.revertedWith("NP");
    });
  });

  describe("#updateMargin", () => {
    // before(async () => {

    //     await positionTest.updateMargin(toBn("10"));

    // });

    it("correctly updates the margin of a position", async () => {
      await positionTest.updateMargin(toBn("10"));

      await positionTest.updateMargin(toBn("-1"));

      const positionMarginUpdated = await positionTest.position();

      expect(positionMarginUpdated[1]).to.eq(toBn("9"));
    });
  });

  describe("#updateBalances", () => {
    before(async () => {});

    it("correctly updates the variable and fixed token balances of a position", async () => {
      await positionTest.updateBalances(toBn("1000"), toBn("-2000"));

      await positionTest.updateBalances(toBn("2000"), toBn("-3000"));

      const positionBalancesUpdated = await positionTest.position();

      expect(positionBalancesUpdated[4]).to.eq(toBn("3000"));
      expect(positionBalancesUpdated[5]).to.eq(toBn("-5000"));
    });
  });

  describe("#updateFixedAndVariableTokenGrowthInside", () => {
    before(async () => {});

    it("check the inside last balances are correctly updated", async () => {
      await positionTest.updateLiquidity(100);

      await positionTest.updateFixedAndVariableTokenGrowthInside(
        toBn("20"),
        toBn("-30")
      );

      const positionUpdated = await positionTest.position();

      expect(positionUpdated[2]).to.eq(toBn("20"));
      expect(positionUpdated[3]).to.eq(toBn("-30"));
    });
  });

  describe("#calculateFixedAndVariableDelta", () => {
    before(async () => {
      const positionFactory = await ethers.getContractFactory("Position");

      const position = (await positionFactory.deploy()) as Position;

      const positionTestFactory = await ethers.getContractFactory(
        "PositionTest",
        {
          libraries: {
            Position: position.address,
          },
        }
      );

      positionTest = (await positionTestFactory.deploy()) as PositionTest;
    });

    it("check the inside last balances are correctly updated", async () => {
      await positionTest.updateLiquidity(10);
      const updatedPosition = await positionTest.position();

      expect(updatedPosition[0]).to.eq(10);

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
