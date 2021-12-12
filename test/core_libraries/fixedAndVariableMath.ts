// NEW

import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { FixedAndVariableMathTest } from "../../typechain/FixedAndVariableMathTest";
import { fixedFactor } from "../shared/utilities";
import { toBn } from "evm-bn";
import { div, sub, mul, add } from "../shared/functions";
import { consts } from "../helpers/constants";

// const SECONDS_IN_YEAR = toBn("31536000");
const BLOCK_TIMESTAMP = 1632249308;

function getFixedTokenBalance(
  amount0: BigNumber,
  amount1: BigNumber,
  variableFactorAccrued: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber
): BigNumber {
  const fixedFactorAccrued: BigNumber = fixedFactor(
    false,
    termStartTimestamp,
    termEndTimestamp
  );

  const excessFixedAccruedBalance: BigNumber = mul(amount0, fixedFactorAccrued);

  const excessVariableAccruedBalance: BigNumber = mul(
    amount1,
    variableFactorAccrued
  );

  const excessBalance: BigNumber = add(
    excessFixedAccruedBalance,
    excessVariableAccruedBalance
  );

  const fixedTokenBalance = calculateFixedTokenBalance(
    amount0,
    excessBalance,
    termStartTimestamp,
    termEndTimestamp
  );

  return fixedTokenBalance;
}

function calculateFixedTokenBalance(
  amount0: BigNumber,
  exceessBalance: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber
): BigNumber {
  const fixedFactorAtMaturity: BigNumber = fixedFactor(
    true,
    termStartTimestamp,
    termEndTimestamp
  );

  const exp1: BigNumber = mul(amount0, fixedFactorAtMaturity);
  const numerator: BigNumber = sub(exp1, exceessBalance);
  const fixedTokenBalance: BigNumber = div(numerator, fixedFactorAtMaturity);

  return fixedTokenBalance;
}

describe("FixedAndVariableMath", () => {
  let fixedAndVariableMathTest: FixedAndVariableMathTest;

  before(async () => {
    await network.provider.send("evm_setNextBlockTimestamp", [BLOCK_TIMESTAMP]);

    const timeFactory = await ethers.getContractFactory("Time");

    const timeLibrary = await timeFactory.deploy();
    // .deployed()?

    const fixedAndVariableMathFactory = await ethers.getContractFactory(
      "FixedAndVariableMath",
      {
        libraries: {
          Time: timeLibrary.address,
        },
      }
    );
    const fixedAndVariableMath = await fixedAndVariableMathFactory.deploy();
    // .deployed()?

    const fixedAndVariableMathTestFactory = await ethers.getContractFactory(
      "FixedAndVariableMathTest",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Time: timeLibrary.address,
        },
      }
    );

    fixedAndVariableMathTest =
      (await fixedAndVariableMathTestFactory.deploy()) as FixedAndVariableMathTest;
  });

  describe("#accrualFact", () => {
    const testSets = [
      [toBn("4")],
      [toBn("50")],
      [toBn("34536000")],
      [toBn("34537000")],
    ];

    testSets.forEach((testSet) => {
      const x: BigNumber = testSet[0];

      it(`takes ${x} and returns the correct value`, async () => {
        const expected: BigNumber = div(x, toBn("31536000"));
        expect(await fixedAndVariableMathTest.accrualFact(x)).to.eq(expected);
      });
    });
  });

  // describe("#fixedFactor", () => {
  //   const testSets = [
  //     [toBn("1636909871"), toBn("1644685871")],
  //     // [false, toBn("1656909871"), toBn("1644685871")], // todo: should raise an error
  //   ];

  //   testSets.forEach((testSet) => {
  //     const atMaturity: boolean = true;
  //     const termStartTimestamp: BigNumber = testSet[0];
  //     const termEndTimestamp: BigNumber = testSet[1];
  //     // const blockTimestamp: BigNumber = toBn("1639909871")

  //     it(`returns the correct fixed factor at maturity`, async () => {
  //       const fixedFactorValue = fixedFactor(
  //         true,
  //         termStartTimestamp,
  //         termEndTimestamp
  //       );

  //       expect(
  //         await fixedAndVariableMathTest.fixedFactor(
  //           atMaturity,
  //           termStartTimestamp,
  //           termEndTimestamp
  //         )
  //       ).to.eq(fixedFactorValue);
  //     });
  //   });

  //   // outputs: Error: Transaction reverted: library was called directly | (but that is the intention)
  //   // it("should revert if Term End Timestamp is lower or equal to Term Start Timestamp", async () => {
  //   //     const atMaturity: boolean = false;
  //   //     const termStartTimestamp: BigNumber = toBn("1644685871");
  //   //     const termEndTimestamp: BigNumber = toBn("1636909871");

  //   //     expect(await fixedAndVariableMathTest.fixedFactor(atMaturity, termStartTimestamp, termEndTimestamp)).to.be.revertedWith("E<=S");
  //   // });
  // });

  // describe("#calculateFixedTokenBalance", () => {
  //   it("correctly calculates the fixed token balance", async () => {
  //     const amount0: BigNumber = toBn("-1000");
  //     const excessBalance: BigNumber = toBn("30");

  //     const termStartTimestamp: BigNumber = toBn("1636909871");
  //     const termEndTimestamp: BigNumber = toBn("1644685871");

  //     const expected: BigNumber = await calculateFixedTokenBalance(
  //       amount0,
  //       excessBalance,
  //       termStartTimestamp,
  //       termEndTimestamp
  //     );

  //     expect(
  //       await fixedAndVariableMathTest.calculateFixedTokenBalance(
  //         amount0,
  //         excessBalance,
  //         termStartTimestamp,
  //         termEndTimestamp
  //       )
  //     ).to.eq(expected);
  //   });
  // });

  // todo: fix this function
  // describe("#getFixedTokenBalance", () => {
  //   it("correctly gets the fixed token balance", async () => {
  //     const amount0: BigNumber = toBn("-1000");
  //     const amount1: BigNumber = toBn("2000");
  //     const variableFactorAccrued: BigNumber = toBn("0.02");
  //     const termEndTimestamp: BigNumber = add(
  //       toBn(BLOCK_TIMESTAMP.toString()),
  //       toBn("7776000")
  //     );
  //     const termStartTimestamp: BigNumber = sub(
  //       toBn(BLOCK_TIMESTAMP.toString()),
  //       toBn("7776000")
  //     );

  //     const expected: BigNumber = getFixedTokenBalance(
  //       amount0,
  //       amount1,
  //       variableFactorAccrued,
  //       termStartTimestamp,
  //       termEndTimestamp
  //     );

  //     expect(
  //       await fixedAndVariableMathTest.getFixedTokenBalance(
  //         amount0,
  //         amount1,
  //         variableFactorAccrued,
  //         termStartTimestamp,
  //         termEndTimestamp
  //       )
  //     ).to.eq(expected);
  //   });
  // });

  // describe("#time", () => {
  //   it("correctly gets the current block timestamp", async () => {
  //     // todo: after the transaction, block timestamp getes incremented by one, need to try and use evm.mine() consistentely
  //     const currentBlockTimestamp = toBn((BLOCK_TIMESTAMP + 1).toString());
  //     expect(await fixedAndVariableMathTest.blockTimestampScaled()).to.eq(
  //       currentBlockTimestamp
  //     );
  //   });
  // });
});
