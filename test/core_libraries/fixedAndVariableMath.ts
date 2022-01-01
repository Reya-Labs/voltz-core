// NEW

import { BigNumber } from "ethers";
import { ethers, network, waffle } from "hardhat";
import { expect } from "chai";
import { FixedAndVariableMathTest } from "../../typechain/FixedAndVariableMathTest";
import { fixedFactor } from "../shared/utilities";
import { toBn } from "evm-bn";
import { div, sub, mul, add } from "../shared/functions";
import { getCurrentTimestamp } from "../helpers/time";
import { ONE_YEAR_IN_SECONDS } from "../shared/constants";

const { provider } = waffle;

// const SECONDS_IN_YEAR = ONE_YEAR_IN_SECONDS;
const BLOCK_TIMESTAMP = 1632249308;

export function getFixedTokenBalance(
  amount0: BigNumber,
  amount1: BigNumber,
  accruedVariableFactor: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  currentBlockTimestamp: BigNumber
): BigNumber {
  const excessBalance = getExcessBalance(
    amount0,
    amount1,
    accruedVariableFactor,
    termStartTimestamp,
    termEndTimestamp,
    currentBlockTimestamp
  );

  return calculateFixedTokenBalance(
    amount0,
    excessBalance,
    termStartTimestamp,
    termEndTimestamp
  );
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
    termEndTimestamp,
    toBn((1632249308).toString()) // temporary
  );

  const exp1: BigNumber = mul(amount0, fixedFactorAtMaturity);
  const numerator: BigNumber = sub(exp1, exceessBalance);
  const fixedTokenBalance: BigNumber = div(numerator, fixedFactorAtMaturity);

  return fixedTokenBalance;
}

function getExcessBalance(
  amount0: BigNumber,
  amount1: BigNumber,
  accruedVariableFactor: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  currentBlockTimestamp: BigNumber
): BigNumber {
  const excessFixedAccruedBalance = mul(
    amount0,
    fixedFactor(
      false,
      termStartTimestamp,
      termEndTimestamp,
      currentBlockTimestamp
    )
  );

  const excessVariableAccruedBalance = mul(amount1, accruedVariableFactor);

  const excessBalance = add(
    excessFixedAccruedBalance,
    excessVariableAccruedBalance
  );

  return excessBalance;
}

function calculateSettlementCashflow(
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  variableFactorToMaturity: BigNumber,
  currentBlockTimestamp: BigNumber
): BigNumber {
  const fixedCashflow = mul(
    fixedTokenBalance,
    fixedFactor(
      true,
      termStartTimestamp,
      termEndTimestamp,
      currentBlockTimestamp
    )
  );

  const variableCashflow = mul(variableTokenBalance, variableFactorToMaturity);

  return add(fixedCashflow, variableCashflow);
}

describe("FixedAndVariableMath", () => {
  let fixedAndVariableMathTest: FixedAndVariableMathTest;

  before(async () => {
    await network.provider.send("evm_setNextBlockTimestamp", [BLOCK_TIMESTAMP]);

    const timeFactory = await ethers.getContractFactory("Time");
    const timeLibrary = await timeFactory.deploy();

    const fixedAndVariableMathFactory = await ethers.getContractFactory(
      "FixedAndVariableMath",
      {
        libraries: {
          Time: timeLibrary.address,
        },
      }
    );

    const fixedAndVariableMath = await fixedAndVariableMathFactory.deploy();
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

  let currentBlockTimestamp: BigNumber;
  beforeEach(async () => {
    currentBlockTimestamp = toBn(
      (await getCurrentTimestamp(provider)).toString()
    );
  });

  describe("#calculateSettlementCashflow", () => {
    const amount0: BigNumber = toBn("-1000");
    const amount1: BigNumber = toBn("1000");
    const accruedVariableFactor: BigNumber = toBn("2");

    it("correctly calculates the settlement cash flow", async () => {
      const termEndTimestamp: BigNumber = add(
        toBn(BLOCK_TIMESTAMP.toString()),
        ONE_YEAR_IN_SECONDS
      );

      const expected: BigNumber = calculateSettlementCashflow(
        amount0,
        amount1,
        accruedVariableFactor,
        currentBlockTimestamp,
        termEndTimestamp,
        currentBlockTimestamp
      );

      expect(
        await fixedAndVariableMathTest.calculateSettlementCashflow(
          amount0,
          amount1,
          accruedVariableFactor,
          currentBlockTimestamp,
          termEndTimestamp
        )
      ).to.eq(expected);
    });
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
        const expected: BigNumber = div(x, ONE_YEAR_IN_SECONDS);
        expect(await fixedAndVariableMathTest.accrualFact(x)).to.eq(expected);
      });
    });
  });

  describe("#fixedFactor", () => {
    it("reverts if the end timestamp is before the start timestamp", async () => {
      await expect(
        fixedAndVariableMathTest.fixedFactorTest(false, toBn("1"), toBn("1"))
      ).to.be.revertedWith("E<=S");
      await expect(
        fixedAndVariableMathTest.fixedFactorTest(false, toBn("2"), toBn("1"))
      ).to.be.revertedWith("E<=S");
    });

    it("reverts unless the start timestamp is in the past", async () => {
      const afterCurrentBlockTimestamp = add(currentBlockTimestamp, toBn("1"));
      const afterAfterCurrentBlockTimestamp = add(
        afterCurrentBlockTimestamp,
        toBn("1")
      );

      await expect(
        fixedAndVariableMathTest.fixedFactorTest(
          false,
          afterCurrentBlockTimestamp,
          afterAfterCurrentBlockTimestamp
        )
      ).to.be.revertedWith("B.T>S");
    });

    it("reverts unless the end timestamp is in the future", async () => {
      const beforeCurrentBlockTimestamp = sub(currentBlockTimestamp, toBn("1"));
      const beforeBeforeCurrentBlockTimestamp = sub(
        beforeCurrentBlockTimestamp,
        toBn("1")
      );

      await expect(
        fixedAndVariableMathTest.fixedFactorTest(
          false,
          beforeBeforeCurrentBlockTimestamp,
          beforeCurrentBlockTimestamp
        )
      ).to.be.revertedWith("B.T>S");
    });

    it(`returns the correct fixed factor at maturity`, async () => {
      const termEndTimestamp = add(currentBlockTimestamp, ONE_YEAR_IN_SECONDS); // one year in seconds
      const atMaturity: boolean = true;

      const fixedFactorValue = fixedFactor(
        true,
        currentBlockTimestamp,
        termEndTimestamp,
        currentBlockTimestamp
      );

      expect(
        await fixedAndVariableMathTest.fixedFactorTest(
          atMaturity,
          currentBlockTimestamp,
          termEndTimestamp
        )
      ).to.eq(fixedFactorValue);
    });

    it(`returns the correct fixed factor before maturity`, async () => {
      const termEndTimestamp = add(currentBlockTimestamp, ONE_YEAR_IN_SECONDS); // one year in seconds
      const atMaturity: boolean = false;

      const fixedFactorValue = fixedFactor(
        false,
        currentBlockTimestamp,
        termEndTimestamp,
        currentBlockTimestamp
      );

      expect(
        await fixedAndVariableMathTest.fixedFactorTest(
          atMaturity,
          currentBlockTimestamp,
          termEndTimestamp
        )
      ).to.eq(fixedFactorValue);
    });
  });

  describe("#calculateFixedTokenBalance", () => {
    const amount0: BigNumber = toBn("-1000");
    const excessBalance: BigNumber = toBn("30");

    it("reverts unless the end timestamp is after the start timestamp", async () => {
      const beforeCurrentBlockTimestamp = sub(currentBlockTimestamp, toBn("1"));

      await expect(
        fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          currentBlockTimestamp,
          currentBlockTimestamp
        )
      ).to.be.revertedWith("E<=S");

      await expect(
        fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          currentBlockTimestamp,
          beforeCurrentBlockTimestamp
        )
      ).to.be.revertedWith("E<=S");
    });

    it("correctly calculates the fixed token balance", async () => {
      const termEndTimestamp = add(currentBlockTimestamp, ONE_YEAR_IN_SECONDS);

      const expected: BigNumber = await calculateFixedTokenBalance(
        amount0,
        excessBalance,
        currentBlockTimestamp,
        termEndTimestamp
      );

      expect(
        await fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          currentBlockTimestamp,
          termEndTimestamp
        )
      ).to.eq(expected);
    });
  });

  describe("#getExcessBalance", () => {
    const amount0: BigNumber = toBn("-1000");
    const amount1: BigNumber = toBn("1000");
    const accruedVariableFactor: BigNumber = toBn("2");

    it("correctly calculates the excess balance", async () => {
      const termEndTimestamp = add(currentBlockTimestamp, ONE_YEAR_IN_SECONDS);

      const expected: BigNumber = await getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        currentBlockTimestamp,
        termEndTimestamp,
        currentBlockTimestamp
      );

      expect(
        await fixedAndVariableMathTest.getExcessBalance(
          amount0,
          amount1,
          accruedVariableFactor,
          currentBlockTimestamp,
          termEndTimestamp
        )
      ).to.eq(expected);
    });
  });

  describe("#getFixedTokenBalance", () => {
    const amount0: BigNumber = toBn("-1000");
    const amount1: BigNumber = toBn("1000");
    const accruedVariableFactor: BigNumber = toBn("2");

    it("reverts unless the end timestamp is after the start timestamp", async () => {
      const beforeCurrentBlockTimestamp = sub(currentBlockTimestamp, toBn("1"));

      await expect(
        fixedAndVariableMathTest.getFixedTokenBalance(
          amount0,
          amount1,
          accruedVariableFactor,
          currentBlockTimestamp,
          currentBlockTimestamp
        )
      ).to.be.revertedWith("E<=S");

      await expect(
        fixedAndVariableMathTest.getFixedTokenBalance(
          amount0,
          amount1,
          accruedVariableFactor,
          currentBlockTimestamp,
          beforeCurrentBlockTimestamp
        )
      ).to.be.revertedWith("E<=S");
    });

    it("correctly gets the fixed token balance", async () => {
      const termEndTimestamp: BigNumber = add(
        toBn(BLOCK_TIMESTAMP.toString()),
        ONE_YEAR_IN_SECONDS
      );

      const expected: BigNumber = getFixedTokenBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        currentBlockTimestamp,
        termEndTimestamp,
        currentBlockTimestamp
      );

      expect(
        await fixedAndVariableMathTest.getFixedTokenBalance(
          amount0,
          amount1,
          accruedVariableFactor,
          currentBlockTimestamp,
          termEndTimestamp
        )
      ).to.eq(expected);
    });
  });
});
