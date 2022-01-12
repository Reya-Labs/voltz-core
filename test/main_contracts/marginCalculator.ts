import { Wallet, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";
import { div, sub, mul, add, sqrt, exp } from "../shared/functions";
import { metaFixture } from "../shared/fixtures";
import {
  expandTo18Decimals,
  accrualFact,
  fixedFactor,
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  MAX_LEVERAGE,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  RATE_ORACLE_ID,
} from "../shared/utilities";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";

import { getFixedTokenBalance } from "../core_libraries/fixedAndVariableMath";

import { consts } from "../helpers/constants";
import { TickMath } from "../shared/tickMath";
import { SqrtPriceMath } from "../shared/sqrtPriceMath";
import JSBI from "jsbi";

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

function getPositionMarginRequirement(
  tickLower: number,
  tickUpper: number,
  isLM: boolean,
  currentTick: number,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  liquidity: JSBI,
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  variableFactor: BigNumber,
  historicalApy: BigNumber,
  blockTimestampScaled: BigNumber
) {
  if (JSBI.equal(liquidity, JSBI.BigInt(0))) {
    return toBn("0.0");
  }

  if (currentTick < tickLower) {
    console.log("TESTTTTTT: currentTick < tickLower");
    if (variableTokenBalance.gt(toBn("0.0"))) {
      throw new Error("varible balance > 0");
    } else if (variableTokenBalance.lt(toBn("0.0"))) {
      return getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestamp,
        termEndTimestamp,
        isLM,
        historicalApy,
        blockTimestampScaled
      );
    } else {
      const amount0JSBI = SqrtPriceMath.getAmount0Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        false
      );

      const amount1JSBI = SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        true
      );

      const amount1 = BigNumber.from(amount1JSBI.toString());

      let amount0 = BigNumber.from(amount0JSBI.toString());
      amount0 = mul(amount0, toBn("-1.0"));

      const expectedVariableTokenBalance = amount1;
      const expectedFixedTokenBalance = getFixedTokenBalance(
        amount0,
        amount1,
        variableFactor,
        termStartTimestamp,
        termEndTimestamp,
        blockTimestampScaled
      );

      return getTraderMarginRequirement(
        expectedFixedTokenBalance,
        expectedVariableTokenBalance,
        termStartTimestamp,
        termEndTimestamp,
        isLM,
        historicalApy,
        blockTimestampScaled
      );
    }
  } else if (currentTick < tickUpper) {
    console.log("TESTTTTTT: currentTick < tickUpper");
    return positionMarginBetweenTicksHelper(
      tickLower,
      tickUpper,
      isLM,
      currentTick,
      termStartTimestamp,
      termEndTimestamp,
      liquidity,
      fixedTokenBalance,
      variableTokenBalance,
      variableFactor,
      historicalApy,
      blockTimestampScaled
    );
  } else {
    console.log("TESTTTTTT: currentTick >= tickLower");
    if (variableTokenBalance.lt(toBn("0.0"))) {
      throw new Error("varible balance < 0");
    } else if (variableTokenBalance.gt(toBn("0.0"))) {
      return getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestamp,
        termEndTimestamp,
        isLM,
        historicalApy,
        blockTimestampScaled
      );
    } else {
      const amount0JSBI = SqrtPriceMath.getAmount0Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        true
      );

      const amount1JSBI = SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        false
      );

      const amount0 = BigNumber.from(amount0JSBI.toString());
      let amount1 = BigNumber.from(amount1JSBI.toString());

      amount1 = mul(amount1, toBn("-1.0"));

      const expectedVariableTokenBalance = amount1;
      const expectedFixedTokenbalance = getFixedTokenBalance(
        amount0,
        amount1,
        variableFactor,
        termStartTimestamp,
        termEndTimestamp,
        blockTimestampScaled
      );

      return getTraderMarginRequirement(
        expectedFixedTokenbalance,
        expectedVariableTokenBalance,
        termStartTimestamp,
        termEndTimestamp,
        isLM,
        historicalApy,
        blockTimestampScaled
      );
    }
  }
}

function positionMarginBetweenTicksHelper(
  tickLower: number,
  tickUpper: number,
  isLM: boolean,
  currentTick: number,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  liquidity: JSBI,
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  variableFactor: BigNumber,
  historicalApy: BigNumber,
  blockTimestampScaled: BigNumber
) {
  // make sure that in here the variable factor is the accrued variable factor
  // emphasise this in the docs

  const amount0UpJSBI = SqrtPriceMath.getAmount0Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickUpper),
    liquidity,
    true
  );

  const amount1UpJSBI = SqrtPriceMath.getAmount1Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickUpper),
    liquidity,
    false
  );

  let amount0Up = BigNumber.from(amount0UpJSBI.toString());
  const amount1Up = BigNumber.from(amount1UpJSBI.toString());

  amount0Up = mul(amount0Up, toBn("-1.0"));

  const expectedVariableTokenBalanceAfterUp: BigNumber = add(
    variableTokenBalance,
    amount1Up
  );
  let fixedTokenBalanceAfterRebalancing: BigNumber = getFixedTokenBalance(
    amount0Up,
    amount1Up,
    variableFactor,
    termStartTimestamp,
    termEndTimestamp,
    blockTimestampScaled
  );
  const expectedFixedTokenBalanceAfterUp: BigNumber = add(
    fixedTokenBalance,
    fixedTokenBalanceAfterRebalancing
  );
  const marginReqAfterUp: BigNumber = getTraderMarginRequirement(
    expectedFixedTokenBalanceAfterUp,
    expectedVariableTokenBalanceAfterUp,
    termStartTimestamp,
    termEndTimestamp,
    isLM,
    historicalApy,
    blockTimestampScaled
  );

  const amount0DownJSBI = SqrtPriceMath.getAmount0Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickLower),
    liquidity,
    false
  );

  const amount1DownJSBI = SqrtPriceMath.getAmount1Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickLower),
    liquidity,
    true
  );

  const amount0Down = BigNumber.from(amount0DownJSBI.toString());
  let amount1Down = BigNumber.from(amount1DownJSBI.toString());

  amount1Down = mul(amount1Down, toBn("-1.0"));

  const expectedVariableTokenBalanceAfterDown: BigNumber = add(
    variableTokenBalance,
    amount1Down
  );
  fixedTokenBalanceAfterRebalancing = getFixedTokenBalance(
    amount0Down,
    amount1Down,
    variableFactor,
    termStartTimestamp,
    termEndTimestamp,
    blockTimestampScaled
  );
  const expectedFixedTokenBalanceAfterDown: BigNumber = add(
    fixedTokenBalance,
    fixedTokenBalanceAfterRebalancing
  );
  const marginReqAfterDown: BigNumber = getTraderMarginRequirement(
    expectedFixedTokenBalanceAfterDown,
    expectedVariableTokenBalanceAfterDown,
    termStartTimestamp,
    termEndTimestamp,
    isLM,
    historicalApy,
    blockTimestampScaled
  );

  let margin: BigNumber;

  if (sub(marginReqAfterUp, marginReqAfterDown) > toBn("0")) {
    margin = marginReqAfterUp;
  } else {
    margin = marginReqAfterDown;
  }

  return margin;
}

function getTraderMarginRequirement(
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  isLM: boolean,
  historicalApy: BigNumber,
  blockTimestampScaled: BigNumber
) {
  if (fixedTokenBalance.gte(toBn("0")) && variableTokenBalance.gte(toBn("0"))) {
    return toBn("0.0");
  }

  let isFT = false;
  if (fixedTokenBalance.gt(toBn("0"))) {
    isFT = true;
  }

  const timeInSecondsFromStartToMaturity: BigNumber = sub(
    termEndTimestamp,
    termStartTimestamp
  );

  const exp1 = mul(
    fixedTokenBalance,
    fixedFactor(
      true,
      termStartTimestamp,
      termEndTimestamp,
      blockTimestampScaled
    )
  );

  const exp2 = mul(
    variableTokenBalance,
    worstCaseVariableFactorAtMaturity(
      timeInSecondsFromStartToMaturity,
      termEndTimestamp,
      blockTimestampScaled,
      isFT,
      isLM,
      historicalApy
    )
  );

  const modelMargin = add(exp1, exp2);
  const minimumMargin = getMinimumMarginRequirement(
    fixedTokenBalance,
    variableTokenBalance,
    termStartTimestamp,
    termEndTimestamp,
    isLM
  );

  let margin: BigNumber;
  if (sub(modelMargin, minimumMargin) < toBn("0")) {
    margin = minimumMargin;
  } else {
    margin = modelMargin;
  }

  return margin;
}

function worstCaseVariableFactorAtMaturity(
  timeInSecondsFromStartToMaturity: BigNumber,
  termEndTimestampScaled: BigNumber,
  currentTimestampScaled: BigNumber,
  isFT: boolean,
  isLM: boolean,
  historicalApy: BigNumber
): BigNumber {
  const timeInYearsFromStartUntilMaturity: BigNumber = accrualFact(
    timeInSecondsFromStartToMaturity
  );

  let variableFactor: BigNumber;
  let apyBound: BigNumber;

  if (isFT) {
    apyBound = computeApyBound(
      termEndTimestampScaled,
      currentTimestampScaled,
      historicalApy,
      true
    );
    if (isLM) {
      variableFactor = mul(timeInYearsFromStartUntilMaturity, apyBound);
    } else {
      variableFactor = mul(
        timeInYearsFromStartUntilMaturity,
        mul(apyBound, APY_UPPER_MULTIPLIER)
      );
    }
  } else {
    apyBound = computeApyBound(
      termEndTimestampScaled,
      currentTimestampScaled,
      historicalApy,
      false
    );
    if (isLM) {
      variableFactor = mul(timeInYearsFromStartUntilMaturity, apyBound);
    } else {
      variableFactor = mul(
        timeInYearsFromStartUntilMaturity,
        mul(apyBound, APY_LOWER_MULTIPLIER)
      );
    }
  }

  return variableFactor;
}

function computeApyBound(
  termEndTimestampScaled: BigNumber,
  currentTimestampScaled: BigNumber,
  historicalApy: BigNumber,
  isUpper: boolean
) {
  const beta4 = mul(toBn("4.0"), BETA);
  const timeFactor = computeTimeFactor(
    BETA,
    termEndTimestampScaled,
    currentTimestampScaled
  );
  const oneMinusTimeFactor: BigNumber = sub(toBn("1"), timeFactor);
  const k: BigNumber = div(ALPHA, SIGMA_SQUARED);
  const zeta: BigNumber = div(mul(SIGMA_SQUARED, oneMinusTimeFactor), beta4);
  const lambdaNum: BigNumber = mul(mul(beta4, timeFactor), historicalApy);
  const lambdaDen: BigNumber = mul(beta4, timeFactor);
  const lambda: BigNumber = div(lambdaNum, lambdaDen);
  const criticalValueMultiplier: BigNumber = mul(
    add(mul(toBn("2"), lambda), k),
    toBn("2")
  );
  const criticalValueMultiplierSqrt: BigNumber = sqrt(criticalValueMultiplier);

  let criticalValue: BigNumber;
  if (isUpper) {
    criticalValue = mul(XI_UPPER, criticalValueMultiplierSqrt);
  } else {
    criticalValue = mul(XI_LOWER, criticalValueMultiplierSqrt);
  }

  let apyBound: BigNumber = mul(zeta, add(add(k, lambda), criticalValue));
  if (apyBound < toBn("0")) {
    apyBound = toBn("0");
  }

  return apyBound;
}

function computeTimeFactor(
  beta: BigNumber,
  termEndTimestampScaled: BigNumber,
  currentTimestampScaled: BigNumber
) {
  const remainingSeconds = sub(termEndTimestampScaled, currentTimestampScaled);
  const scaledTime = div(remainingSeconds, T_MAX);
  // console.log("Scaled Time is: ", scaledTime.toString());
  // console.log("Remaining seconds is: ", remainingSeconds.toString());
  const expInput = mul(mul(beta, toBn("-1.0")), scaledTime);
  // console.log("Exp input is : ", expInput.toString());

  return exp(expInput);
}

function getMinimumMarginRequirement(
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  isLM: boolean
) {
  const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp);
  const timeInYears: BigNumber = accrualFact(timeInSeconds);
  let minDelta: BigNumber;
  let margin: BigNumber;
  let notional: BigNumber;

  if (isLM) {
    minDelta = MIN_DELTA_LM;
  } else {
    minDelta = MIN_DELTA_IM;
  }

  if (variableTokenBalance < toBn("0")) {
    // isFT
    // variable token balance must be negative
    notional = mul(variableTokenBalance, toBn("-1"));
    margin = mul(notional, mul(minDelta, timeInYears));
  } else {
    notional = variableTokenBalance;
    const zeroLowerBoundMargin: BigNumber = mul(
      fixedTokenBalance,
      mul(
        fixedFactor(
          true,
          termStartTimestamp,
          termEndTimestamp,
          toBn((1632249308).toString())
        ),
        toBn("-1")
      )
    );
    // console.log(`Test: Zero Lower Bound Margin is${zeroLowerBoundMargin}`);
    margin = mul(mul(variableTokenBalance, minDelta), timeInYears);

    if (sub(margin, zeroLowerBoundMargin) > toBn("0")) {
      margin = zeroLowerBoundMargin;
    }
  }

  // console.log(`Test: Notional is ${notional}`);
  // console.log(`Test: Margin is ${margin}`);
  // console.log(
  //   `Test: Fixed Factor is${fixedFactor(
  //     true,
  //     termStartTimestamp,
  //     termEndTimestamp,
  //     toBn((1632249308).toString())
  //   )}`
  // );

  return margin;
}

describe("MarginCalculator", () => {
  // - Setup

  let wallet: Wallet, other: Wallet;
  let testMarginCalculator: MarginCalculatorTest;

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("MarginCalculator Parameters", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
    });

    it("correctly sets the Margin Calculator Parameters", async () => {
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );

      const marginCalculatorParameters =
        await testMarginCalculator.getMarginCalculatorParametersTest(
          RATE_ORACLE_ID
        );
      expect(marginCalculatorParameters[0]).to.eq(APY_UPPER_MULTIPLIER);
      expect(marginCalculatorParameters[1]).to.eq(APY_LOWER_MULTIPLIER);
      expect(marginCalculatorParameters[2]).to.eq(MIN_DELTA_LM);
      expect(marginCalculatorParameters[3]).to.eq(MIN_DELTA_IM);
      expect(marginCalculatorParameters[4]).to.eq(MAX_LEVERAGE);
      expect(marginCalculatorParameters[5]).to.eq(SIGMA_SQUARED);
      expect(marginCalculatorParameters[6]).to.eq(ALPHA);
      expect(marginCalculatorParameters[7]).to.eq(BETA);
      expect(marginCalculatorParameters[8]).to.eq(XI_UPPER);
      expect(marginCalculatorParameters[9]).to.eq(XI_LOWER);
      expect(marginCalculatorParameters[10]).to.eq(T_MAX);
    });
  });

  describe("getMinimumMarginRequirement (zeroLowerBound boolean is true)", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    // passes
    it("correctly calculates the minimum margin requirement: fixed taker, LM, FT", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number =
        termStartTimestamp + consts.ONE_DAY.toNumber();

      const termStartTimestampBN: BigNumber = toBn(
        termStartTimestamp.toString()
      );
      const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

      const isLM: boolean = true;
      const historicalApy: BigNumber = toBn("0.02");

      const expectedMinimumMarginRequirement: BigNumber =
        getMinimumMarginRequirement(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await testMarginCalculator.getMinimumMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );
      // expect(realisedMinimumMarginRequirement).to.eq(expectedMinimumMarginRequirement);
      expect(realisedMinimumMarginRequirement).to.be.closeTo(
        expectedMinimumMarginRequirement,
        10000000000000
      );
    });

    // passes
    it("correctly calculates the minimum margin requirement: fixed taker, LM, VT", async () => {
      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number =
        termStartTimestamp + consts.ONE_DAY.toNumber();

      const termStartTimestampBN: BigNumber = toBn(
        termStartTimestamp.toString()
      );
      const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

      const isLM: boolean = true;
      const historicalApy: BigNumber = toBn("0.02");

      const expectedMinimumMarginRequirement: BigNumber =
        getMinimumMarginRequirement(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await testMarginCalculator.getMinimumMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );
      expect(realisedMinimumMarginRequirement).to.eq(
        expectedMinimumMarginRequirement
      );
    });

    // passes
    it("correctly calculates the minimum margin requirement: fixed taker, IM, VT", async () => {
      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number =
        termStartTimestamp + consts.ONE_DAY.toNumber();

      const termStartTimestampBN: BigNumber = toBn(
        termStartTimestamp.toString()
      );
      const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

      const isLM: boolean = false;
      const historicalApy: BigNumber = toBn("0.02");

      const expectedMinimumMarginRequirement: BigNumber =
        getMinimumMarginRequirement(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await testMarginCalculator.getMinimumMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );
      expect(realisedMinimumMarginRequirement).to.eq(
        expectedMinimumMarginRequirement
      );
    });
  });

  describe("#computeTimeFactor", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("reverts if termEndTimestamp isn't > 0", async () => {
      await expect(
        testMarginCalculator.computeTimeFactorTest(
          RATE_ORACLE_ID,
          toBn("0"),
          toBn("1")
        )
      ).to.be.revertedWith("termEndTimestamp must be > 0");
    });

    it("reverts if currentTimestamp is larger than termEndTimestamp", async () => {
      await expect(
        testMarginCalculator.computeTimeFactorTest(
          RATE_ORACLE_ID,
          toBn("1"),
          toBn("2")
        )
      ).to.be.revertedWith("endTime must be > currentTime");
    });

    it("reverts if given invalid rateOracleId", async () => {
      await expect(
        testMarginCalculator.computeTimeFactorTest(
          utils.formatBytes32String("unknownOracle"),
          toBn("0"),
          toBn("1")
        )
      ).to.be.revertedWith("termEndTimestamp must be > 0");
    });

    it("correctly computes the time factor", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const expected = computeTimeFactor(
        BETA,
        termEndTimestampScaled,
        toBn(currentTimestamp.toString())
      );

      const realized = await testMarginCalculator.computeTimeFactorTest(
        RATE_ORACLE_ID,
        termEndTimestampScaled,
        toBn(currentTimestamp.toString())
      );

      expect(realized).to.be.closeTo(expected, 100);
    });
  });

  describe("#computeApyBound", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    // passes
    it("correctly computes the Upper APY Bound", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const historicalApy: BigNumber = toBn("0.02");
      const isUpper: boolean = true;

      const expected: BigNumber = computeApyBound(
        termEndTimestampScaled,
        currentTimestampScaled,
        historicalApy,
        isUpper
      );

      expect(
        await testMarginCalculator.computeApyBoundTest(
          RATE_ORACLE_ID,
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper
        )
      ).to.be.closeTo(expected, 10000000000000);
    });

    // passes
    it("correctly computes the Lower APY Bound", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const historicalApy: BigNumber = toBn("0.02");
      const isUpper: boolean = false;

      const expected: BigNumber = computeApyBound(
        termEndTimestampScaled,
        currentTimestampScaled,
        historicalApy,
        isUpper
      );
      expect(
        await testMarginCalculator.computeApyBoundTest(
          RATE_ORACLE_ID,
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper
        )
      ).to.be.closeTo(expected, 10000000000000);
    });
  });

  describe("#getTraderMarginRequirement", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("returns zero if position isn't settled", async () => {
      const fixedTokenBalance: BigNumber = toBn("10000");
      const variableTokenBalance: BigNumber = toBn("1000");

      expect(
        await testMarginCalculator.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          toBn("0"),
          toBn("0"),
          false,
          RATE_ORACLE_ID,
          toBn("0.1")
        )
      );
    });
  });

  describe("#worstCaseVariableFactorAtMaturity", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly calculates the worst case variable factor at maturity FT, LM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = true;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturityBN,
        termEndTimestampScaled,
        currentTimestampScaled,
        isFT,
        isLM,
        historicalApy
      );

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      expect(realized).to.be.closeTo(expected, 100);
    });

    it("correctly calculates the worst case variable factor at maturity FT, IM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = true;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturityBN,
        termEndTimestampScaled,
        currentTimestampScaled,
        isFT,
        isLM,
        historicalApy
      );

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);
    });

    it("correctly calculates the worst case variable factor at maturity VT, LM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = false;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturityBN,
        termEndTimestampScaled,
        currentTimestampScaled,
        isFT,
        isLM,
        historicalApy
      );

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      expect(realized).to.be.closeTo(expected, 100);
    });

    it("correctly calculates the worst case variable factor at maturity VT, IM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = false;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturityBN,
        termEndTimestampScaled,
        currentTimestampScaled,
        isFT,
        isLM,
        historicalApy
      );

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);
    });
  });

  describe("#getTraderMarginRequirement", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly calculates the trader margin requirement: FT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());
      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampScaled,
          termEndTimestampScaled,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampScaled,
        termEndTimestampScaled,
        isLM,
        historicalApy,
        currentTimestampScaled
      );

      expect(realized).to.be.closeTo(expected, 100);
    });

    it("correctly calculates the trader margin requirement: FT, IM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampScaled,
          termEndTimestampScaled,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampScaled,
        termEndTimestampScaled,
        isLM,
        historicalApy,
        currentTimestampScaled
      );

      expect(realized).to.be.closeTo(expected, 100);
    });

    it("correctly calculates the trader margin requirement: VT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const isLM = true;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampScaled,
          termEndTimestampScaled,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampScaled,
        termEndTimestampScaled,
        isLM,
        historicalApy,
        currentTimestampScaled
      );

      expect(realized).to.be.closeTo(expected, 100);
    });

    it("correctly calculates the trader margin requirement: VT, IM", async () => {
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampScaled,
          termEndTimestampScaled,
          isLM,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampScaled,
        termEndTimestampScaled,
        isLM,
        historicalApy,
        currentTimestampScaled
      );

      expect(realized).to.be.closeTo(expected, 100);
    });
  });

  describe("#positionMarginBetweenTicksHelper", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly calculates positionMarginBetweenTicks (current tick is 0), LM, (-1, 1)", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = 0;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized =
        await testMarginCalculator.positionMarginBetweenTicksHelperTest(
          tickLower,
          tickUpper,
          isLM,
          currentTick,
          termStartTimestampScaled,
          termEndTimestampScaled,
          liquidityBN,
          fixedTokenBalance,
          variableTokenBalance,
          variableFactor,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = positionMarginBetweenTicksHelper(
        tickLower,
        tickUpper,
        isLM,
        currentTick,
        termStartTimestampScaled,
        termEndTimestampScaled,
        liquidityJSBI,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy,
        currentTimestampScaled
      );

      console.log("TESTTT: realised", realized.toString());
      console.log("TESTTT: expected", expected.toString());

      expect(realized).to.be.closeTo(expected, 10000000000000);
    });

    it("correctly calculates positionMarginBetweenTicks (current tick is -1), LM, (-1, 1)", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = -1;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized =
        await testMarginCalculator.positionMarginBetweenTicksHelperTest(
          tickLower,
          tickUpper,
          isLM,
          currentTick,
          termStartTimestampScaled,
          termEndTimestampScaled,
          liquidityBN,
          fixedTokenBalance,
          variableTokenBalance,
          variableFactor,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = positionMarginBetweenTicksHelper(
        tickLower,
        tickUpper,
        isLM,
        currentTick,
        termStartTimestampScaled,
        termEndTimestampScaled,
        liquidityJSBI,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy,
        currentTimestampScaled
      );

      expect(realized).to.be.closeTo(expected, 10000000000000);
    });

    it("correctly calculates positionMarginBetweenTicks (current tick is -1), LM, (-1, 1), starting fixed and variable balances are 0", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = -1;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized =
        await testMarginCalculator.positionMarginBetweenTicksHelperTest(
          tickLower,
          tickUpper,
          isLM,
          currentTick,
          termStartTimestampScaled,
          termEndTimestampScaled,
          liquidityBN,
          fixedTokenBalance,
          variableTokenBalance,
          variableFactor,
          RATE_ORACLE_ID,
          historicalApy
        );

      const expected = positionMarginBetweenTicksHelper(
        tickLower,
        tickUpper,
        isLM,
        currentTick,
        termStartTimestampScaled,
        termEndTimestampScaled,
        liquidityJSBI,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy,
        currentTimestampScaled
      );

      expect(realized).to.be.closeTo(expected, 10000000000000);
    });

    it("reverts positionMarginBetweenTicks (current tick is -10), LM, (-1, 1)", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = -10;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);

      await expect(
        testMarginCalculator.positionMarginBetweenTicksHelperTest(
          tickLower,
          tickUpper,
          isLM,
          currentTick,
          termStartTimestampScaled,
          termEndTimestampScaled,
          liquidityBN,
          fixedTokenBalance,
          variableTokenBalance,
          variableFactor,
          RATE_ORACLE_ID,
          historicalApy
        )
      ).to.be.revertedWith("currentTick >= tickLower");
    });

    it("reverts positionMarginBetweenTicks (current tick is -10), IM, (-1, 1)", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = false;
      const currentTick: number = -10;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);

      await expect(
        testMarginCalculator.positionMarginBetweenTicksHelperTest(
          tickLower,
          tickUpper,
          isLM,
          currentTick,
          termStartTimestampScaled,
          termEndTimestampScaled,
          liquidityBN,
          fixedTokenBalance,
          variableTokenBalance,
          variableFactor,
          RATE_ORACLE_ID,
          historicalApy
        )
      ).to.be.revertedWith("currentTick >= tickLower");
    });
  });

  describe("#getPositionMarginRequirement", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly calculates positionMargin (current tick is 0), LM, (-1, 1)", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = 0;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized =
        await testMarginCalculator.getPositionMarginRequirementTest(
          tickLower,
          tickUpper,
          isLM,
          currentTick,
          termStartTimestampScaled,
          termEndTimestampScaled,
          liquidityBN,
          fixedTokenBalance,
          variableTokenBalance,
          variableFactor,
          RATE_ORACLE_ID,
          historicalApy
        );

      console.log("Realised is: ", realized.toString());

      const expected = getPositionMarginRequirement(
        tickLower,
        tickUpper,
        isLM,
        currentTick,
        termStartTimestampScaled,
        termEndTimestampScaled,
        liquidityJSBI,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy,
        currentTimestampScaled
      );

      console.log("Expected is: ", expected.toString());

      expect(realized).to.be.closeTo(expected, 10000000000000);
    });
  });

  describe("#isLiquiisLiquidatableTrader", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly checks for the fact the trader is liquidatable", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const isLM = false;
      const historicalApy = toBn("0.1");
      const currentMargin = toBn("0.0");

      const realized = await testMarginCalculator.isLiquidatableTraderTest(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestamp,
        termEndTimestampScaled,
        isLM,
        RATE_ORACLE_ID,
        historicalApy,
        currentMargin
      );
      expect(realized).to.be.eq(true);
    });
  });

  describe("#isLiquiisLiquidatablePosition", async () => {
    beforeEach("deploy calculator", async () => {
      ({ testMarginCalculator } = await loadFixture(metaFixture));
      await testMarginCalculator.setMarginCalculatorParametersTest(
        RATE_ORACLE_ID,
        APY_UPPER_MULTIPLIER,
        APY_LOWER_MULTIPLIER,
        MIN_DELTA_LM,
        MIN_DELTA_IM,
        MAX_LEVERAGE,
        SIGMA_SQUARED,
        ALPHA,
        BETA,
        XI_UPPER,
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly checks for the fact the position is liquidatable", async () => {
      const tickLower: number = -1;
      const tickUpper: number = 1;
      const currentTick: number = 0;

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;

      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const currentMargin = toBn("0.0");

      const realized = await testMarginCalculator.isLiquidatablePositionLMTest(
        tickLower,
        tickUpper,
        currentTick,
        termStartTimestampScaled,
        termEndTimestampScaled,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        RATE_ORACLE_ID,
        historicalApy,
        currentMargin
      );

      expect(realized).to.eq(true);
    });
  });
});


// SPDX-License-Identifier: MIT

// todo: fix given that now MarginCalculator is a library

// pragma solidity ^0.8.0;
// import "../MarginCalculator.sol";
// import "../interfaces/IMarginCalculator.sol";

// contract MarginCalculatorTest is MarginCalculator {
//     // solhint-disable-next-line no-empty-blocks
//     constructor(address _factory) MarginCalculator(_factory) {}

//     // view functions

//     function computeTimeFactorTest(
//         bytes32 rateOracleId,
//         uint256 termEndTimestampScaled,
//         uint256 currentTimestampScaled
//     ) external view returns (int256 timeFactor) {
//         return
//             computeTimeFactor(
//                 rateOracleId,
//                 termEndTimestampScaled,
//                 currentTimestampScaled
//             );
//     }

//     function calculateExpectedAmountsTest(
//         uint128 liquidity,
//         int24 currentTick,
//         int24 tickUpper,
//         int24 tickLower
//     ) external pure returns (int256 amount1Up, int256 amount0Down) {
//         // go through this again [ask Moody for elaboration]

//         // want this to be negative

//         amount1Up = SqrtPriceMath.getAmount1Delta(
//             TickMath.getSqrtRatioAtTick(currentTick),
//             TickMath.getSqrtRatioAtTick(tickUpper),
//             -int128(liquidity)
//         );

//         // want this to be negative

//         amount0Down = SqrtPriceMath.getAmount0Delta(
//             TickMath.getSqrtRatioAtTick(currentTick),
//             TickMath.getSqrtRatioAtTick(tickLower),
//             -int128(liquidity)
//         );
//     }

//     function positionMarginBetweenTicksHelperTest(
//         int24 tickLower,
//         int24 tickUpper,
//         bool isLM,
//         int24 currentTick,
//         uint256 termStartTimestamp,
//         uint256 termEndTimestamp,
//         uint128 liquidity,
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 variableFactor,
//         bytes32 rateOracleId,
//         uint256 historicalApy
//     ) external view returns (uint256 margin) {
//         return
//             positionMarginBetweenTicksHelper(
//                 PositionMarginRequirementParams({
//                     owner: address(0), // owner should not matter for the purposes of computing position's margin
//                     tickLower: tickLower,
//                     tickUpper: tickUpper,
//                     isLM: isLM,
//                     currentTick: currentTick,
//                     termStartTimestamp: termStartTimestamp,
//                     termEndTimestamp: termEndTimestamp,
//                     liquidity: liquidity,
//                     fixedTokenBalance: fixedTokenBalance,
//                     variableTokenBalance: variableTokenBalance,
//                     variableFactor: variableFactor,
//                     rateOracleId: rateOracleId,
//                     historicalApy: historicalApy
//                 })
//             );
//     }

//     function getPositionMarginRequirementTest(
//         int24 tickLower,
//         int24 tickUpper,
//         bool isLM,
//         int24 currentTick,
//         uint256 termStartTimestamp,
//         uint256 termEndTimestamp,
//         uint128 liquidity,
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 variableFactor,
//         bytes32 rateOracleId,
//         uint256 historicalApy
//     ) external view returns (uint256 margin) {
//         return
//             getPositionMarginRequirement(
//                 PositionMarginRequirementParams({
//                     owner: address(0), // owner should not matter for the purposes of computing position's margin
//                     tickLower: tickLower,
//                     tickUpper: tickUpper,
//                     isLM: isLM,
//                     currentTick: currentTick,
//                     termStartTimestamp: termStartTimestamp,
//                     termEndTimestamp: termEndTimestamp,
//                     liquidity: liquidity,
//                     fixedTokenBalance: fixedTokenBalance,
//                     variableTokenBalance: variableTokenBalance,
//                     variableFactor: variableFactor,
//                     rateOracleId: rateOracleId,
//                     historicalApy: historicalApy
//                 })
//             );
//     }

//     function getTraderMarginRequirementTest(
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 termStartTimestamp,
//         uint256 termEndTimestamp,
//         bool isLM,
//         bytes32 rateOracleId,
//         uint256 historicalApy
//     ) external view returns (uint256 margin) {
//         return
//             getTraderMarginRequirement(
//                 TraderMarginRequirementParams({
//                     fixedTokenBalance: fixedTokenBalance,
//                     variableTokenBalance: variableTokenBalance,
//                     termStartTimestamp: termStartTimestamp,
//                     termEndTimestamp: termEndTimestamp,
//                     isLM: isLM,
//                     rateOracleId: rateOracleId,
//                     historicalApy: historicalApy
//                 })
//             );
//     }

//     function worstCaseVariableFactorAtMaturityTest(
//         uint256 timeInSecondsFromStartToMaturity,
//         uint256 termEndTimestampScaled,
//         uint256 currentTimestampScaled,
//         bool isFT,
//         bool isLM,
//         bytes32 rateOracleId,
//         uint256 historicalApy
//     ) external view returns (uint256 variableFactor) {
//         return
//             worstCaseVariableFactorAtMaturity(
//                 timeInSecondsFromStartToMaturity,
//                 termEndTimestampScaled,
//                 currentTimestampScaled,
//                 isFT,
//                 isLM,
//                 rateOracleId,
//                 historicalApy
//             );
//     }

//     function getMarginCalculatorParametersTest(bytes32 rateOracleId)
//         external
//         view
//         returns (
//             uint256 apyUpperMultiplier,
//             uint256 apyLowerMultiplier,
//             uint256 minDeltaLM,
//             uint256 minDeltaIM,
//             uint256 maxLeverage,
//             int256 sigmaSquared,
//             int256 alpha,
//             int256 beta,
//             int256 xiUpper,
//             int256 xiLower,
//             int256 tMax
//         )
//     {
//         MarginCalculatorParameters
//             memory marginCalculatorParameters = getMarginCalculatorParameters[
//                 rateOracleId
//             ];

//         apyUpperMultiplier = marginCalculatorParameters.apyUpperMultiplier;
//         apyLowerMultiplier = marginCalculatorParameters.apyLowerMultiplier;
//         minDeltaLM = marginCalculatorParameters.minDeltaLM;
//         minDeltaIM = marginCalculatorParameters.minDeltaIM;
//         maxLeverage = marginCalculatorParameters.maxLeverage;
//         sigmaSquared = marginCalculatorParameters.sigmaSquared;
//         alpha = marginCalculatorParameters.alpha;
//         beta = marginCalculatorParameters.beta;
//         xiUpper = marginCalculatorParameters.xiUpper;
//         xiLower = marginCalculatorParameters.xiLower;
//         tMax = marginCalculatorParameters.tMax;
//     }

//     function getMinimumMarginRequirementTest(
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 termStartTimestamp,
//         uint256 termEndTimestamp,
//         bool isLM,
//         bytes32 rateOracleId,
//         uint256 historicalApy
//     ) external view returns (uint256 margin) {
//         return
//             getMinimumMarginRequirement(
//                 IMarginCalculator.TraderMarginRequirementParams({
//                     fixedTokenBalance: fixedTokenBalance,
//                     variableTokenBalance: variableTokenBalance,
//                     termStartTimestamp: termStartTimestamp,
//                     termEndTimestamp: termEndTimestamp,
//                     isLM: isLM,
//                     rateOracleId: rateOracleId,
//                     historicalApy: historicalApy
//                 })
//             );
//     }

//     function computeApyBoundTest(
//         bytes32 rateOracleId,
//         uint256 termEndTimestampScaled,
//         uint256 currentTimestampScaled,
//         uint256 historicalApy,
//         bool isUpper
//     ) external view returns (uint256 apyBound) {
//         return
//             computeApyBound(
//                 rateOracleId,
//                 termEndTimestampScaled,
//                 currentTimestampScaled,
//                 historicalApy,
//                 isUpper
//             );
//     }

//     function setMarginCalculatorParametersTest(
//         bytes32 rateOracleId,
//         uint256 apyUpperMultiplier,
//         uint256 apyLowerMultiplier,
//         uint256 minDeltaLM,
//         uint256 minDeltaIM,
//         uint256 maxLeverage,
//         int256 sigmaSquared,
//         int256 alpha,
//         int256 beta,
//         int256 xiUpper,
//         int256 xiLower,
//         int256 tMax
//     ) external {
//         setMarginCalculatorParameters(
//             MarginCalculatorParameters(
//                 apyUpperMultiplier,
//                 apyLowerMultiplier,
//                 minDeltaLM,
//                 minDeltaIM,
//                 maxLeverage,
//                 sigmaSquared,
//                 alpha,
//                 beta,
//                 xiUpper,
//                 xiLower,
//                 tMax
//             ),
//             rateOracleId
//         );
//     }

//     function isLiquidatableTraderTest(
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 termStartTimestamp,
//         uint256 termEndTimestamp,
//         bool isLM,
//         bytes32 rateOracleId,
//         uint256 historicalApy,
//         int256 currentMargin
//     ) external view returns (bool) {
//         return
//             isLiquidatableTrader(
//                 TraderMarginRequirementParams({
//                     fixedTokenBalance: fixedTokenBalance,
//                     variableTokenBalance: variableTokenBalance,
//                     termStartTimestamp: termStartTimestamp,
//                     termEndTimestamp: termEndTimestamp,
//                     isLM: isLM,
//                     rateOracleId: rateOracleId,
//                     historicalApy: historicalApy
//                 }),
//                 currentMargin
//             );
//     }

//     function isLiquidatablePositionLMTest(
//         int24 tickLower,
//         int24 tickUpper,
//         // bool isLM,
//         int24 currentTick,
//         uint256 termStartTimestamp,
//         uint256 termEndTimestamp,
//         uint128 liquidity,
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 variableFactor,
//         bytes32 rateOracleId,
//         uint256 historicalApy,
//         int256 currentMargin
//     ) external view returns (bool) {
//         return
//             isLiquidatablePosition(
//                 PositionMarginRequirementParams({
//                     owner: address(0), // owner should not matter for the purposes of computing position's margin
//                     tickLower: tickLower,
//                     tickUpper: tickUpper,
//                     isLM: true,
//                     currentTick: currentTick,
//                     termStartTimestamp: termStartTimestamp,
//                     termEndTimestamp: termEndTimestamp,
//                     liquidity: liquidity,
//                     fixedTokenBalance: fixedTokenBalance,
//                     variableTokenBalance: variableTokenBalance,
//                     variableFactor: variableFactor,
//                     rateOracleId: rateOracleId,
//                     historicalApy: historicalApy
//                 }),
//                 currentMargin
//             );
//     }
// }
