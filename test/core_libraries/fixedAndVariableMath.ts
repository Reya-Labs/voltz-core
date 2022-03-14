// NEW

import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { expect } from "../shared/expect";
import { FixedAndVariableMathTest } from "../../typechain/FixedAndVariableMathTest";
import { toBn } from "evm-bn";
import { sub, add } from "../shared/functions";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import { ONE_YEAR_IN_SECONDS, ONE_WEEK_IN_SECONDS } from "../shared/constants";

const { provider } = waffle;

describe("FixedAndVariableMath", () => {
  let fixedAndVariableMathTest: FixedAndVariableMathTest;

  before(async () => {
    const fixedAndVariableMathTestFactory = await ethers.getContractFactory(
      "FixedAndVariableMathTest"
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
    it("correctly calculates the settlement cash flow", async () => {
      const amount0 = toBn("1000");
      const amount1 = toBn("-1000");
      const accruedVariableFactor = toBn("0.02");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized =
        await fixedAndVariableMathTest.calculateSettlementCashflow(
          amount0,
          amount1,
          termStartTimestamp,
          termEndTimestamp,
          accruedVariableFactor
        );

      expect(realized).to.eq("-19424657534246576000");
    });

    it("correctly calculates the settlement cash flow", async () => {
      const amount0 = toBn("1000");
      const amount1 = toBn("-300");
      const accruedVariableFactor = toBn("0.02");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized =
        await fixedAndVariableMathTest.calculateSettlementCashflow(
          amount0,
          amount1,
          termStartTimestamp,
          termEndTimestamp,
          accruedVariableFactor
        );

      expect(realized).to.eq("-5424657534246576000");
    });

    // TODO: make this work according to the spreadsheet "FixedAndVariableMath"
    it("scenario", async () => {
      const amount0 = toBn("-1000");
      const amount1 = toBn("10000");
      const accruedVariableFactor = toBn("0.001998");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(currentBlockTimestamp, ONE_WEEK_IN_SECONDS); // one week in seconds

      const realized =
        await fixedAndVariableMathTest.calculateSettlementCashflow(
          amount0,
          amount1,
          termStartTimestamp,
          termEndTimestamp,
          accruedVariableFactor
        );

      const excessBalance = await fixedAndVariableMathTest.getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );
      console.log("excess:", excessBalance.toString());

      const fixedFactor = await fixedAndVariableMathTest.fixedFactorTest(
        true,
        termStartTimestamp,
        termEndTimestamp
      );
      console.log("fixedFactor:", fixedFactor.toString());

      console.log("cashflow: ", realized.toString());
    });
  });

  describe("#accrualFact", () => {
    const testSets = [
      [toBn("4"), "126839167935"],
      [toBn("50"), "1585489599188"],
      [toBn("34536000"), "1095129375951293759"],
      [toBn("34537000"), "1095161085743277524"],
    ];

    testSets.forEach((testSet) => {
      const x = testSet[0];
      const expected = testSet[1];

      it(`takes ${x} and returns the correct value`, async () => {
        const realized = await fixedAndVariableMathTest.accrualFact(x);
        expect(realized).to.eq(expected);
      });
    });
  });

  describe("#fixedFactor", () => {
    it(`returns the correct fixed factor at maturity`, async () => {
      const termEndTimestamp = add(currentBlockTimestamp, ONE_YEAR_IN_SECONDS); // one year in seconds
      const atMaturity: boolean = true;

      const realized = await fixedAndVariableMathTest.fixedFactorTest(
        atMaturity,
        currentBlockTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq(toBn("0.01"));
    });

    it(`returns the correct fixed factor before maturity`, async () => {
      const termEndTimestamp = add(currentBlockTimestamp, ONE_YEAR_IN_SECONDS); // one year in seconds
      const atMaturity: boolean = false;

      const realized = await fixedAndVariableMathTest.fixedFactorTest(
        atMaturity,
        currentBlockTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq(toBn("0"));
    });

    it(`returns the correct fixed factor at maturity for 2 weeks`, async () => {
      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds
      const atMaturity: boolean = true;

      const realized = await fixedAndVariableMathTest.fixedFactorTest(
        atMaturity,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq("575342465753424");
    });

    it(`returns the correct fixed factor before maturity for 2 weeks`, async () => {
      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds
      const atMaturity: boolean = false;

      const realized = await fixedAndVariableMathTest.fixedFactorTest(
        atMaturity,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq("191780821917808");
    });

    it(`reverts: end <= start`, async () => {
      const termStartTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = currentBlockTimestamp;
      const atMaturity: boolean = false;

      await expect(
        fixedAndVariableMathTest.fixedFactorTest(
          atMaturity,
          termStartTimestamp,
          termEndTimestamp
        )
      ).to.be.revertedWith("E<=S");
    });

    it(`reverts: current < start`, async () => {
      const termStartTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds
      const atMaturity: boolean = false;

      await expect(
        fixedAndVariableMathTest.fixedFactorTest(
          atMaturity,
          termStartTimestamp,
          termEndTimestamp
        )
      ).to.be.revertedWith("B.T<S");
    });
  });

  describe("#calculateFixedTokenBalance", () => {
    it("reverts unless the end timestamp is after the start timestamp", async () => {
      const beforeCurrentBlockTimestamp = sub(currentBlockTimestamp, toBn("1"));

      const amount0: BigNumber = toBn("-1000");
      const excessBalance: BigNumber = toBn("30");

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
      const amount0: BigNumber = toBn("-1000");
      const excessBalance: BigNumber = toBn("30");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const fixedFactor = await fixedAndVariableMathTest.fixedFactorTest(
        true,
        termStartTimestamp,
        termEndTimestamp
      );
      console.log("fixedFactor: ", fixedFactor.toString());

      const realized =
        await fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          termStartTimestamp,
          termEndTimestamp
        );

      expect(realized).to.eq("-53142857142857202448979");
    });

    it("correctly calculates the fixed token balance", async () => {
      const amount0: BigNumber = toBn("-100");
      const excessBalance: BigNumber = toBn("100");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized =
        await fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          termStartTimestamp,
          termEndTimestamp
        );

      expect(realized).to.eq("-173909523809524008163265");
    });

    it("correctly calculates the fixed token balance", async () => {
      const amount0: BigNumber = toBn("1000");
      const excessBalance: BigNumber = toBn("-30");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized =
        await fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          termStartTimestamp,
          termEndTimestamp
        );

      expect(realized).to.eq("53142857142857202448979");
    });

    it("balance = amount0 when excess is 0", async () => {
      const amount0: BigNumber = toBn("1000");
      const excessBalance: BigNumber = toBn("0");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized =
        await fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          termStartTimestamp,
          termEndTimestamp
        );

      expect(realized).to.eq(amount0);
    });
  });

  describe("#getExcessBalance", () => {
    it("correctly calculates the excess balance", async () => {
      const amount0: BigNumber = toBn("-1000");
      const amount1: BigNumber = toBn("1000");
      const accruedVariableFactor: BigNumber = toBn("0.02");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized = await fixedAndVariableMathTest.getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq("19808219178082192000");
    });

    it("correctly calculates the excess balance", async () => {
      const amount0: BigNumber = toBn("-1000");
      const amount1: BigNumber = toBn("2000");
      const accruedVariableFactor: BigNumber = toBn("0.02");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized = await fixedAndVariableMathTest.getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq("39808219178082192000");
    });

    it("correctly calculates the excess balance", async () => {
      const amount0: BigNumber = toBn("1000");
      const amount1: BigNumber = toBn("-1000");
      const accruedVariableFactor: BigNumber = toBn("0.02");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized = await fixedAndVariableMathTest.getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq("-19808219178082192000");
    });

    it("correctly calculates the excess balance", async () => {
      const amount0: BigNumber = toBn("1000");
      const amount1: BigNumber = toBn("-2000");
      const accruedVariableFactor: BigNumber = toBn("0.02");

      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const realized = await fixedAndVariableMathTest.getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq("-39808219178082192000");
    });
  });

  describe("#getFixedTokenBalance", () => {
    it("correctly gets the fixed token balance", async () => {
      const amount0: BigNumber = toBn("1000");
      const amount1: BigNumber = toBn("-1000");
      const accruedVariableFactor: BigNumber = toBn("0.02");
      const termStartTimestamp = sub(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS
      ); // one week in seconds
      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      ); // two weeks in seconds

      const excessBalance = await fixedAndVariableMathTest.getExcessBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );

      const fixedTokenBalance =
        await fixedAndVariableMathTest.calculateFixedTokenBalance(
          amount0,
          excessBalance,
          termStartTimestamp,
          termEndTimestamp
        );

      const realized = await fixedAndVariableMathTest.getFixedTokenBalance(
        amount0,
        amount1,
        accruedVariableFactor,
        termStartTimestamp,
        termEndTimestamp
      );

      expect(realized).to.eq(fixedTokenBalance);
    });
  });

  describe("full scenarios", async () => {
    it("scenario 1", async () => {
      const amount0Unbalanced = toBn("-1000");
      const amount1 = toBn("10000");

      // none of the variables below are in wad

      const variableFactorFromPoolInitiationToNow = toBn("0.001");
      const variableFactorFromPoolInitiationToPoolMaturity = toBn("0.003000");

      const termEndTimestamp = add(
        currentBlockTimestamp,
        ONE_WEEK_IN_SECONDS.mul(2)
      );

      console.log("currentBlockTimestamp", currentBlockTimestamp.toString());
      console.log("termEndTimestamp", termEndTimestamp.toString());

      await advanceTimeAndBlock(BigNumber.from(604800), 2);

      const amount0Rebalanced =
        await fixedAndVariableMathTest.getFixedTokenBalance(
          amount0Unbalanced,
          amount1,
          variableFactorFromPoolInitiationToNow,
          currentBlockTimestamp, // termStart
          termEndTimestamp
        );

      console.log("amount0Rebalanced TS", amount0Rebalanced.toString());

      const realizedCashflow =
        await fixedAndVariableMathTest.calculateSettlementCashflow(
          amount0Rebalanced,
          amount1,
          currentBlockTimestamp, // termStart
          termEndTimestamp,
          variableFactorFromPoolInitiationToPoolMaturity
        );

      console.log("realizedCashflow", realizedCashflow.toString());

      // 19,788,239,158,101,500,000.00 (excel value)
      // 19,808,219,812,278,031,000 (realised value)

      expect(realizedCashflow).to.be.near(toBn("19.808219812278031000"));
    });
  });
});
