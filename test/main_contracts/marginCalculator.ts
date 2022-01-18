import { Wallet, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";
import { div, sub, mul, add, sqrt, exp } from "../shared/functions";
import { marginCalculatorFixture } from "../shared/fixtures";
import {
  accrualFact,
  fixedFactor,
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  expandTo18Decimals,
} from "../shared/utilities";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";

import { mostSignificantBit, TickMath } from "../shared/tickMath";
import { SqrtPriceMath } from "../shared/sqrtPriceMath";
import JSBI from "jsbi";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import {
  ERC20Mock,
  Factory,
  MockAaveLendingPool,
  TestMarginEngine,
  TestVAMM,
} from "../../typechain";

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

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
  let testRateOracle: TestRateOracle;

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("#computeTimeFactor", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    it("reverts if termEndTimestamp isn't > 0", async () => {
      await expect(
        testMarginCalculator.computeTimeFactor(
          toBn("0"),
          toBn("1"),
          margin_engine_params
        )
      ).to.be.revertedWith("termEndTimestamp must be > 0");
    });

    it("reverts if currentTimestamp is larger than termEndTimestamp", async () => {
      await expect(
        testMarginCalculator.computeTimeFactor(
          toBn("1"),
          toBn("2"),
          margin_engine_params
        )
      ).to.be.revertedWith("endTime must be > currentTime");
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

      const realized = await testMarginCalculator.computeTimeFactor(
        termEndTimestampScaled,
        toBn(currentTimestamp.toString()),
        margin_engine_params
      );

      expect(realized).to.be.closeTo(expected, 100);
    });
  });

  describe("#computeApyBound", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
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
        await testMarginCalculator.computeApyBound(
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper,
          margin_engine_params
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
        await testMarginCalculator.computeApyBound(
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper,
          margin_engine_params
        )
      ).to.be.closeTo(expected, 10000000000000);
    });
  });

  describe("#getTraderMarginRequirement", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    it("returns zero if position isn't settled", async () => {
      const fixedTokenBalance: BigNumber = toBn("10000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const trader_margin_requirement_params = {
        fixedTokenBalance: toBn("10000"),
        variableTokenBalance: toBn("1000"),
        termStartTimestampWad: toBn("0"),
        termEndTimestampWad: toBn("1"),
        isLM: false,
        historicalApyWad: toBn("0.1"),
      };

      expect(
        await testMarginCalculator.getTraderMarginRequirement(
          trader_margin_requirement_params,
          margin_engine_params
        )
      );
    });
  });

  describe("#worstCaseVariableFactorAtMaturity", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
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
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
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
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
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
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
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
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
        );

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);
    });
  });

  describe("#getTraderMarginRequirement", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
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

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
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

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
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

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
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

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
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

  describe("#isLiquiisLiquidatableTrader", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

    ({testMarginCalculator} = await loadFixture(marginCalculatorFixture));
    });

    it("correctly checks for the fact the trader is liquidatable", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;

      const termStartTimestamp = currentTimestamp - 604800;
      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const termEndTimestampScaled = toBn(
        (termStartTimestamp + 604800).toString() // add a week
      );

      const isLM = false;
      const historicalApy = toBn("0.1");
      const currentMargin = toBn("0.0");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy
      }

      const realized = await testMarginCalculator.isLiquidatableTrader(
        trader_margin_requirement_params,
        currentMargin,
        margin_engine_params
      );
      expect(realized).to.be.eq(true);
    });
  });

  describe("#isLiquiisLiquidatablePosition", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

    ({testMarginCalculator} = await loadFixture(marginCalculatorFixture));
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

      const isLM = false;

      const position_margin_requirement_params = {
        owner: wallet.address,
        tickLower: tickLower,
        tickUpper: tickUpper,
        isLM: isLM,
        currentTick: currentTick,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        liquidity: liquidityBN,
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        variableFactorWad: variableFactor,
        historicalApyWad: historicalApy
      }

      const realized = await testMarginCalculator.isLiquidatablePosition(
        position_margin_requirement_params,
        currentMargin,
        margin_engine_params
      );

      expect(realized).to.eq(true);
    });
  });
});
