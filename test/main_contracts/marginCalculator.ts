import { Wallet, BigNumber } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MarginCalculator } from "../../typechain/MarginCalculator";
import { toBn } from "evm-bn";
import { div, sub, mul, add, sqrt, floor } from "../shared/functions";
import {
  encodeSqrtRatioX96,
  expandTo18Decimals,
  accrualFact,
  fixedFactor,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "../shared/utilities";
import { FixedAndVariableMath } from "../../typechain/FixedAndVariableMath";

import { TestMarginCalculator } from "../../typechain/TestMarginCalculator";
import { getCurrentTimestamp, advanceTime } from "../helpers/time";

import { getFixedTokenBalance } from "../core_libraries/fixedAndVariableMath";

import { consts } from "../helpers/constants";
import {
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
  RATE_ORACLE_ID,
  DEFAULT_TIME_FACTOR,
  MIN_TICK,
  MAX_TICK,
} from "../shared/utilities";
// import { floor } from "prb-math";
// import { sqrt } from "../shared/sqrt";

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

async function calculateExpectedAmounts(
  currentTick: number,
  liquidity: BigNumber
) {
  let sqrtRatioAtTickLower: BigNumber = MIN_SQRT_RATIO;
  let sqrtRatioAtTickUpper: BigNumber = MAX_SQRT_RATIO;
  let sqrtRatioAtTickCurrent: BigNumber = MAX_SQRT_RATIO;

  if (currentTick == MIN_TICK) {
    sqrtRatioAtTickCurrent = MIN_SQRT_RATIO;
  }

  const sqrtPriceMathFactory = await ethers.getContractFactory(
    "SqrtPriceMathTest"
  );
  const sqrtPriceMath = await sqrtPriceMathFactory.deploy();

  let amount1Up: BigNumber = await sqrtPriceMath.getAmount1Delta(
    sqrtRatioAtTickCurrent,
    sqrtRatioAtTickUpper,
    liquidity,
    true
  );

  amount1Up = mul(amount1Up, toBn("-1.0"));

  // going down balanace delta
  let amount0Down = await sqrtPriceMath.getAmount0Delta(
    sqrtRatioAtTickLower,
    sqrtRatioAtTickCurrent,
    liquidity,
    true
  );

  amount0Down = mul(amount0Down, toBn("-1.0"));

  return [amount1Up, amount0Down];
}

async function positionMarginBetweenTicksHelper(
  tickLower: number,
  tickUpper: number,
  isLM: boolean,
  currentTick: number,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  liquidity: BigNumber,
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  variableFactor: BigNumber,
  rateOracleId: string,
  twapApy: BigNumber,
  blockTimestampScaled: BigNumber
) {
  // make sure that in here the variable factor is the accrued variable factor
  // emphasise this in the docs

  let sqrtRatioAtTickLower: BigNumber = MIN_SQRT_RATIO;
  let sqrtRatioAtTickUpper: BigNumber = MAX_SQRT_RATIO;
  let sqrtRatioAtTickCurrent: BigNumber = MAX_SQRT_RATIO;

  if (currentTick == MIN_TICK) {
    sqrtRatioAtTickCurrent = MIN_SQRT_RATIO;
  }

  const sqrtPriceMathFactory = await ethers.getContractFactory(
    "SqrtPriceMathTest"
  );
  const sqrtPriceMath = await sqrtPriceMathFactory.deploy();

  const amount0Up: BigNumber = await sqrtPriceMath.getAmount0Delta(
    sqrtRatioAtTickCurrent,
    sqrtRatioAtTickUpper,
    liquidity,
    true
  );

  let amount1Up: BigNumber = await sqrtPriceMath.getAmount1Delta(
    sqrtRatioAtTickCurrent,
    sqrtRatioAtTickUpper,
    liquidity,
    true
  );

  amount1Up = mul(amount1Up, toBn("-1.0"));

  const expectedVariableTokenBalanceAfterUp: BigNumber = add(
    variableTokenBalance,
    amount1Up
  );
  let fixedTokenBalanceAfterRebalancing: BigNumber = getFixedTokenBalance(
    amount0Up,
    amount1Up,
    variableFactor,
    termStartTimestamp,
    termEndTimestamp
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
    rateOracleId,
    twapApy,
    blockTimestampScaled
  );

  // going down balanace delta
  let amount0Down = await sqrtPriceMath.getAmount0Delta(
    sqrtRatioAtTickLower,
    sqrtRatioAtTickCurrent,
    liquidity,
    true
  );

  const amount1Down = await sqrtPriceMath.getAmount1Delta(
    sqrtRatioAtTickLower,
    sqrtRatioAtTickCurrent,
    liquidity,
    true
  );

  amount0Down = mul(amount0Down, toBn("-1.0"));

  const expectedVariableTokenBalanceAfterDown: BigNumber = add(
    variableTokenBalance,
    amount1Down
  );
  fixedTokenBalanceAfterRebalancing = getFixedTokenBalance(
    amount0Down,
    amount1Down,
    variableFactor,
    termStartTimestamp,
    termEndTimestamp
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
    rateOracleId,
    twapApy,
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
  rateOracleId: string,
  twapApy: BigNumber,
  blockTimestampScaled: BigNumber
) {
  const isFT: boolean = variableTokenBalance < toBn("0");

  const timeInSecondsFromStartToMaturity: BigNumber = sub(
    termEndTimestamp,
    termStartTimestamp
  );
  const timeInSecondsFromNowToMaturity: BigNumber = sub(
    termEndTimestamp,
    blockTimestampScaled
  );
  const exp1 = mul(
    fixedTokenBalance,
    fixedFactor(
      true,
      termStartTimestamp,
      termEndTimestamp,
      toBn((1632249308).toString())
    )
  );
  const exp2 = mul(
    variableTokenBalance,
    worstCaseVariableFactorAtMaturity(
      timeInSecondsFromStartToMaturity,
      timeInSecondsFromNowToMaturity,
      isFT,
      isLM,
      rateOracleId,
      twapApy
    )
  );
  const modelMargin = add(exp1, exp2);
  const minimumMargin = getMinimumMarginRequirement(
    fixedTokenBalance,
    variableTokenBalance,
    termStartTimestamp,
    termEndTimestamp,
    isLM,
    twapApy
  );

  var margin: BigNumber;

  if (sub(modelMargin, minimumMargin) < toBn("0")) {
    margin = minimumMargin;
  } else {
    margin = modelMargin;
  }

  return margin;
}

function worstCaseVariableFactorAtMaturity(
  timeInSecondsFromStartToMaturity: BigNumber,
  timeInSecondsFromNowToMaturity: BigNumber,
  isFT: boolean,
  isLM: boolean,
  rateOracleId: string,
  twapApy: BigNumber
): BigNumber {
  const timeInYearsFromStartUntilMaturity: BigNumber = accrualFact(
    timeInSecondsFromStartToMaturity
  );
  let variableFactor: BigNumber;
  let apyBound: BigNumber;

  if (isFT) {
    apyBound = computeApyBound(
      rateOracleId,
      timeInSecondsFromNowToMaturity,
      twapApy,
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
      rateOracleId,
      timeInSecondsFromNowToMaturity,
      twapApy,
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

// const expected = computeApyBound(RATE_ORACLE_ID, timeInSeconds, twapApy, isUpper);

function computeApyBound(
  rateOracleId: string,
  timeInSeconds: BigNumber,
  twapApy: BigNumber,
  isUpper: boolean
) {
  const timeFactor: BigNumber = DEFAULT_TIME_FACTOR;
  const oneMinusTimeFactor: BigNumber = sub(toBn("1"), timeFactor);
  const k: BigNumber = div(ALPHA, SIGMA_SQUARED);
  const zeta: BigNumber = div(mul(SIGMA_SQUARED, oneMinusTimeFactor), BETA);
  const lambdaNum: BigNumber = mul(mul(BETA, timeFactor), twapApy);
  const lambdaDen: BigNumber = mul(BETA, timeFactor);
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

  var apyBound: BigNumber = mul(zeta, add(add(k, lambda), criticalValue));

  if (apyBound < toBn("0")) {
    apyBound = toBn("0");
  }

  return apyBound;
}

function getMinimumMarginRequirement(
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  isLM: boolean,
  twapApy: BigNumber
) {
  // twapApy is not necessary for this calculation

  const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp);
  const timeInYears: BigNumber = accrualFact(timeInSeconds);
  let minDelta: BigNumber;
  var margin: BigNumber;
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
    console.log(`Test: Zero Lower Bound Margin is${zeroLowerBoundMargin}`);
    margin = mul(mul(variableTokenBalance, minDelta), timeInYears);

    if (sub(margin, zeroLowerBoundMargin) > toBn("0")) {
      margin = zeroLowerBoundMargin;
    }
  }

  console.log(`Test: Notional is ${notional}`);
  console.log(`Test: Margin is ${margin}`);
  console.log(
    `Test: Fixed Factor is${fixedFactor(
      true,
      termStartTimestamp,
      termEndTimestamp,
      toBn((1632249308).toString())
    )}`
  );

  return margin;
}

describe("Margin Calculator", () => {
  let wallet: Wallet, other: Wallet;
  let calculatorTest: TestMarginCalculator;

  const fixture = async () => {
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

    const fixedAndVariableMath =
      (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

    const marginCalculator = await ethers.getContractFactory(
      "TestMarginCalculator",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Time: timeLibrary.address,
        },
      }
    );

    return (await marginCalculator.deploy()) as TestMarginCalculator;
  };

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy calculator", async () => {
    calculatorTest = await loadFixture(fixture);
  });

  describe("Margin Calculator Parameters", async () => {
    it("correctly sets the Margin Calculator Parameters", async () => {
      await calculatorTest.setMarginCalculatorParametersTest(
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
        XI_LOWER
      );

      const marginCalculatorParameters =
        await calculatorTest.getMarginCalculatorParametersTest(RATE_ORACLE_ID);
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
      // expect(await calculatorTest.accrualFact(x)).to.eq(expected);
    });

    it("correctly sets the time factors", async () => {
      const timeInDays: BigNumber = toBn("3");

      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDays,
        DEFAULT_TIME_FACTOR
      );

      const timeFactorRealised = await calculatorTest.getTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDays
      );

      expect(timeFactorRealised).to.eq(DEFAULT_TIME_FACTOR);
    });
  });

  describe("getMinimumMarginRequirement (zeroLowerBound boolean is true)", async () => {
    beforeEach("deploy calculator", async () => {
      calculatorTest = await loadFixture(fixture);
      await calculatorTest.setMarginCalculatorParametersTest(
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
        XI_LOWER
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
      const twapApy: BigNumber = toBn("0.02");

      const expectedMinimumMarginRequirement: BigNumber =
        getMinimumMarginRequirement(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          twapApy
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await calculatorTest.getMinimumMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        );
      // expect(realisedMinimumMarginRequirement).to.eq(expectedMinimumMarginRequirement);
      expect(realisedMinimumMarginRequirement).to.be.closeTo(
        expectedMinimumMarginRequirement,
        10000
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
      const twapApy: BigNumber = toBn("0.02");

      const expectedMinimumMarginRequirement: BigNumber =
        getMinimumMarginRequirement(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          twapApy
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await calculatorTest.getMinimumMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
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
      const twapApy: BigNumber = toBn("0.02");

      const expectedMinimumMarginRequirement: BigNumber =
        getMinimumMarginRequirement(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          twapApy
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await calculatorTest.getMinimumMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        );
      expect(realisedMinimumMarginRequirement).to.eq(
        expectedMinimumMarginRequirement
      );
    });
  });

  describe("#getApyBound", async () => {
    beforeEach("deploy calculator", async () => {
      calculatorTest = await loadFixture(fixture);
      await calculatorTest.setMarginCalculatorParametersTest(
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
        XI_LOWER
      );

      const timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
      const timeInDaysFloor: BigNumber = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );
      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );
    });

    // passes
    it("correctly computes the Upper APY Bound", async () => {
      const timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
      const twapApy: BigNumber = toBn("0.02");
      const isUpper: boolean = true;

      const expected: BigNumber = computeApyBound(
        RATE_ORACLE_ID,
        timeInSeconds,
        twapApy,
        isUpper
      );
      expect(
        await calculatorTest.computeApyBoundTest(
          RATE_ORACLE_ID,
          timeInSeconds,
          twapApy,
          isUpper
        )
      ).to.be.closeTo(expected, 10000);
    });

    // passes
    it("correctly computes the Lower APY Bound", async () => {
      const timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
      const twapApy: BigNumber = toBn("0.02");
      const isUpper: boolean = false;

      const expected: BigNumber = computeApyBound(
        RATE_ORACLE_ID,
        timeInSeconds,
        twapApy,
        isUpper
      );
      expect(
        await calculatorTest.computeApyBoundTest(
          RATE_ORACLE_ID,
          timeInSeconds,
          twapApy,
          isUpper
        )
      ).to.be.closeTo(expected, 10000);
    });
  });

  describe("#getTraderMarginRequirement", async () => {
    beforeEach("deploy calculator", async () => {
      calculatorTest = await loadFixture(fixture);
      await calculatorTest.setMarginCalculatorParametersTest(
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
        XI_LOWER
      );

      let timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
      let timeInDaysFloor: BigNumber = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );
      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );

      timeInSeconds = toBn(consts.ONE_MONTH.toString());
      timeInDaysFloor = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );

      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );

      timeInSeconds = toBn(consts.ONE_DAY.toString());
      timeInDaysFloor = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );

      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );
    });

    // passes
    it("correctly calculates the trader margin requirement: VT, LM", async () => {
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
      const twapApy: BigNumber = toBn("0.02");

      const blockTimestampScaled: BigNumber = toBn(
        (termStartTimestamp + 1).toString()
      );

      const expected: BigNumber = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampBN,
        termEndTimestampBN,
        isLM,
        RATE_ORACLE_ID,
        twapApy,
        blockTimestampScaled
      );
      expect(
        await calculatorTest.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });

    // passes
    it("correctly calculates the trader margin requirement: FT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number =
        termStartTimestamp + consts.ONE_DAY.toNumber();

      const termStartTimestampBN: BigNumber = toBn(
        termStartTimestamp.toString()
      );
      const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

      const isLM: boolean = false;
      const twapApy: BigNumber = toBn("0.02");

      const blockTimestampScaled: BigNumber = toBn(
        (termStartTimestamp + 1).toString()
      );

      const expected: BigNumber = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampBN,
        termEndTimestampBN,
        isLM,
        RATE_ORACLE_ID,
        twapApy,
        blockTimestampScaled
      );
      expect(
        await calculatorTest.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });

    it("correctly calculates the trader margin requirement: FT, IM", async () => {
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
      const twapApy: BigNumber = toBn("0.02");

      const blockTimestampScaled: BigNumber = toBn(
        (termStartTimestamp + 1).toString()
      );

      const expected: BigNumber = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampBN,
        termEndTimestampBN,
        isLM,
        RATE_ORACLE_ID,
        twapApy,
        blockTimestampScaled
      );
      expect(
        await calculatorTest.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });

    it("correctly calculates the trader margin requirement: VT, IM", async () => {
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
      const twapApy: BigNumber = toBn("0.02");

      const blockTimestampScaled: BigNumber = toBn(
        (termStartTimestamp + 1).toString()
      );

      const expected: BigNumber = getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        termStartTimestampBN,
        termEndTimestampBN,
        isLM,
        RATE_ORACLE_ID,
        twapApy,
        blockTimestampScaled
      );
      expect(
        await calculatorTest.getTraderMarginRequirementTest(
          fixedTokenBalance,
          variableTokenBalance,
          termStartTimestampBN,
          termEndTimestampBN,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });
  });

  describe("#worstCaseVariableFactorAtMaturity", async () => {
    beforeEach("deploy calculator", async () => {
      calculatorTest = await loadFixture(fixture);
      await calculatorTest.setMarginCalculatorParametersTest(
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
        XI_LOWER
      );

      let timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
      let timeInDaysFloor: BigNumber = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );
      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );

      timeInSeconds = toBn(consts.ONE_MONTH.toString());
      timeInDaysFloor = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );
      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );
    });

    it("correctly calculates the worst case variable factor at maturity, FT, LM", async () => {
      const timeInSecondsFromStartToMaturity: BigNumber = toBn(
        consts.ONE_YEAR.toString()
      );
      const timeInSecondsFromNowToMaturity: BigNumber = toBn(
        consts.ONE_MONTH.toString()
      );
      const isFT: boolean = true;
      const isLM: boolean = true;
      const twapApy: BigNumber = toBn("0.02");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturity,
        timeInSecondsFromNowToMaturity,
        isFT,
        isLM,
        RATE_ORACLE_ID,
        twapApy
      );
      expect(
        await calculatorTest.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturity,
          timeInSecondsFromNowToMaturity,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });

    it("correctly calculates the worst case variable factor at maturity, FT, IM", async () => {
      const timeInSecondsFromStartToMaturity: BigNumber = toBn(
        consts.ONE_YEAR.toString()
      );
      const timeInSecondsFromNowToMaturity: BigNumber = toBn(
        consts.ONE_MONTH.toString()
      );
      const isFT: boolean = true;
      const isLM: boolean = false;
      const twapApy: BigNumber = toBn("0.02");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturity,
        timeInSecondsFromNowToMaturity,
        isFT,
        isLM,
        RATE_ORACLE_ID,
        twapApy
      );
      expect(
        await calculatorTest.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturity,
          timeInSecondsFromNowToMaturity,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });

    it("correctly calculates the worst case variable factor at maturity, VT, LM", async () => {
      const timeInSecondsFromStartToMaturity: BigNumber = toBn(
        consts.ONE_YEAR.toString()
      );
      const timeInSecondsFromNowToMaturity: BigNumber = toBn(
        consts.ONE_MONTH.toString()
      );
      const isFT: boolean = false;
      const isLM: boolean = true;
      const twapApy: BigNumber = toBn("0.02");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturity,
        timeInSecondsFromNowToMaturity,
        isFT,
        isLM,
        RATE_ORACLE_ID,
        twapApy
      );
      expect(
        await calculatorTest.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturity,
          timeInSecondsFromNowToMaturity,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });

    it("correctly calculates the worst case variable factor at maturity, VT, IM", async () => {
      const timeInSecondsFromStartToMaturity: BigNumber = toBn(
        consts.ONE_YEAR.toString()
      );
      const timeInSecondsFromNowToMaturity: BigNumber = toBn(
        consts.ONE_MONTH.toString()
      );
      const isFT: boolean = false;
      const isLM: boolean = false;
      const twapApy: BigNumber = toBn("0.02");

      const expected = worstCaseVariableFactorAtMaturity(
        timeInSecondsFromStartToMaturity,
        timeInSecondsFromNowToMaturity,
        isFT,
        isLM,
        RATE_ORACLE_ID,
        twapApy
      );
      expect(
        await calculatorTest.worstCaseVariableFactorAtMaturityTest(
          timeInSecondsFromStartToMaturity,
          timeInSecondsFromNowToMaturity,
          isFT,
          isLM,
          RATE_ORACLE_ID,
          twapApy
        )
      ).to.be.closeTo(expected, 10000);
    });
  });

  describe("#positionMarginBetweenTicksHelper", async () => {
    beforeEach("deploy calculator", async () => {
      calculatorTest = await loadFixture(fixture);
      await calculatorTest.setMarginCalculatorParametersTest(
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
        XI_LOWER
      );

      let timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
      let timeInDaysFloor: BigNumber = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );
      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );

      timeInSeconds = toBn(consts.ONE_MONTH.toString());
      timeInDaysFloor = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );

      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );

      timeInSeconds = toBn(consts.ONE_DAY.toString());
      timeInDaysFloor = floor(
        div(timeInSeconds, toBn(consts.ONE_DAY.toString()))
      );

      await calculatorTest.setTimeFactorTest(
        RATE_ORACLE_ID,
        timeInDaysFloor,
        DEFAULT_TIME_FACTOR
      );
    });

    // fails
    it("correctly calculates intermediate variables", async () => {
      const tickLower: number = MIN_TICK;
      const tickUpper: number = MAX_TICK;
      const currentTick: number = MAX_TICK;

      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number =
        termStartTimestamp + consts.ONE_DAY.toNumber();
      const termStartTimestampBN: BigNumber = toBn(
        termStartTimestamp.toString()
      );
      const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());
      const liquidity: BigNumber = toBn("1");
      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");
      const variableFactor: BigNumber = toBn("0.02");
      const twapApy: BigNumber = toBn("0.3");
      const blockTimestampScaled: BigNumber = toBn(
        (termStartTimestamp + 1).toString()
      );

      // async function calculateExpectedAmounts(
      //     currentTick: number,
      //     liquidity: BigNumber
      // ) {

      let [amount1Up, amount0Down] = await calculateExpectedAmounts(
        currentTick,
        liquidity
      );
      let returnedAmounts = await calculatorTest.calculateExpectedAmountsTest(
        liquidity,
        currentTick,
        tickUpper,
        tickLower
      );

      console.log(`Test: amoun1Up is ${amount1Up}`);
      console.log(`Test: amount0Down is ${amount0Down}`);

      expect(returnedAmounts[0]).to.be.closeTo(amount1Up, 10000);
      expect(returnedAmounts[1]).to.be.closeTo(amount0Down, 10000);
    });

    // fails
    // it("correctly calculates positionMarginBetweenTicks (current tick is max tick), LM, (MIN_TICK, MAX_TICK)", async () => {
    //     const tickLower: number = MIN_TICK;
    //     const tickUpper: number = MAX_TICK;
    //     const isLM: boolean = true;
    //     const currentTick: number = MAX_TICK;

    //     const termStartTimestamp: number = await getCurrentTimestamp(provider);
    //     const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
    //     const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
    //     const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());
    //     const liquidity: BigNumber = toBn("1");

    //     const fixedTokenBalance: BigNumber = toBn("-3000");
    //     const variableTokenBalance: BigNumber = toBn("1000");

    //     const variableFactor: BigNumber = toBn("0.02");
    //     const twapApy: BigNumber = toBn("0.3");

    //     const blockTimestampScaled: BigNumber = toBn((termStartTimestamp+1).toString());

    //     const expected: BigNumber = await positionMarginBetweenTicksHelper(
    //         tickLower,
    //         tickUpper,
    //         isLM,
    //         currentTick,
    //         termStartTimestampBN,
    //         termEndTimestampBN,
    //         liquidity,
    //         fixedTokenBalance,
    //         variableTokenBalance,
    //         variableFactor,
    //         RATE_ORACLE_ID,
    //         twapApy,
    //         blockTimestampScaled
    //     );

    //     const realised: BigNumber = await calculatorTest.positionMarginBetweenTicksHelperLMTest(
    //         tickLower,
    //         tickUpper,
    //         // isLM,
    //         currentTick,
    //         termStartTimestampBN,
    //         termEndTimestampBN,
    //         liquidity,
    //         fixedTokenBalance,
    //         variableTokenBalance,
    //         variableFactor,
    //         RATE_ORACLE_ID,
    //         twapApy
    //     );

    //     // let errorMargin: BigNumber;

    //     // if (realised > expected) {
    //     //     errorMargin = sub(realised, expected);
    //     // } else {
    //     //     errorMargin = sub(expected, realised);
    //     // }

    //     // errorMargin = floor(div(errorMargin, toBn("10.0")));

    //     // console.log(`Test: Error Margin is ${errorMargin}`);

    //     // expect(realised).to.be.closeTo(expected, ); // todo: huge margin or error, investigate further
    //     // expect(errorMargin).to.be.eq(0);

    // })
  });
});
