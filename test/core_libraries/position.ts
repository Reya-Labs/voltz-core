// hybrid of uniswap + new

/*
Below are some of the old tests written for position.ts


If the below code 

it("reverts if liquidity delta is zero", async () => {
            
    expect(positionTest.updateLiquidity(0)).to.be.revertedWith("NP")

})

is not commented out, we get an error of this type: https://github.com/mochajs/mocha/issues/1066. Need to figure out the root cause.


*/

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

  before(async () => {
    await createSnapshot(provider);

    // const positionFactory = await ethers.getContractFactory("Position");

    // const position = await positionFactory.deploy();

    const positionTestFactory = await ethers.getContractFactory(
      "PositionTest",
      {
        // libraries: {
        //     Position: position.address
        // }
      }
    );

    positionTest = (await positionTestFactory.deploy()) as PositionTest;
  });

  after(async () => {
    // revert back to initial state after all tests pass
    await restoreSnapshot(provider);
  });

  describe("#updateLiquidity", () => {
    // before(async () => {

    //     // const positionLiquidity = await positionTest.position()
    //     // expect(positionLiquidity[0]).to.eq(0)

    // });

    it("correctly updates the liqudity of a position", async () => {
      await positionTest.updateLiquidity(100);

      await positionTest.updateLiquidity(-10);

      const positionLiquidityUpdated = await positionTest.position();

      expect(positionLiquidityUpdated[0]).to.eq(90);
    });

    // it("reverts if liquidity delta is zero", async () => {

    //     expect(positionTest.updateLiquidity(0)).to.be.revertedWith("NP")

    // })
  });

  // describe("#updateMargin", () => {

  //     // before(async () => {

  //     //     await positionTest.updateMargin(toBn("10"));

  //     // });

  //     it("correctly updates the margin of a position", async () => {

  //         await positionTest.updateMargin(toBn("10"));

  //         await positionTest.updateMargin(toBn("-1"));

  //         const positionMarginUpdated = await positionTest.position()

  //         expect(positionMarginUpdated[1]).to.eq(toBn("9"))

  //     })

  // });

  describe("#updateBalances", () => {
    // before(async () => {

    // });

    it("correctly updates the variable and fixed token balances of a position", async () => {
      await positionTest.updateBalances(toBn("1000"), toBn("-2000"));

      await positionTest.updateBalances(toBn("2000"), toBn("-3000"));

      const positionBalancesUpdated = await positionTest.position();

      expect(positionBalancesUpdated[4]).to.eq(toBn("3000"));
      expect(positionBalancesUpdated[5]).to.eq(toBn("-5000"));
    });
  });

  describe("#updateFixedAndVariableTokenGrowthInside", () => {
    // before(async () => {

    // });

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
      await createSnapshot(provider);

      // const positionFactory = await ethers.getContractFactory(
      //     "Position"
      // );

      // const position = (await positionFactory.deployx());

      const positionTestFactory = await ethers.getContractFactory(
        "PositionTest",
        {
          // libraries: {
          //     Position: position.address
          // }
        }
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
