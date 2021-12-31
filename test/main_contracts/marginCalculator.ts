// todo: fix given the recent changes made to the MarginCalculator timeFactor
import { Wallet, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MarginCalculator } from "../../typechain/MarginCalculator";
import { toBn } from "evm-bn";
import { div, sub, mul, add, sqrt, floor, exp } from "../shared/functions";
import { factoryFixture } from "../shared/fixtures";
import {
  encodeSqrtRatioX96,
  expandTo18Decimals,
  accrualFact,
  fixedFactor,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "../shared/utilities";
import { FixedAndVariableMath } from "../../typechain/FixedAndVariableMath";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
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
  T_MAX,
  RATE_ORACLE_ID,
  DEFAULT_TIME_FACTOR,
  MIN_TICK,
  MAX_TICK,
} from "../shared/utilities";
import { TickMath } from "../shared/tickMath";
import { SqrtPriceMath } from "../shared/sqrtPriceMath";
import JSBI from 'jsbi'


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
      throw new Error('varible balance > 0');
    } else if (variableTokenBalance.lt(toBn("0.0"))) {
      return getTraderMarginRequirement(
        fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM, historicalApy, blockTimestampScaled
      );
    } else {
      let amount0JSBI = SqrtPriceMath.getAmount0Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        false
      );
    
      let amount1JSBI = SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        true
      );
    
      let amount0 = BigNumber.from(amount0JSBI.toString());
      let amount1 = BigNumber.from(amount1JSBI.toString());
    
      amount0 = mul(amount0, toBn("-1.0"));
      
      const expectedVariableTokenBalance = amount1;
      const expectedFixedTokenBalance = getFixedTokenBalance(amount0, amount1, variableFactor, termStartTimestamp, termEndTimestamp);

      return getTraderMarginRequirement(expectedFixedTokenBalance, expectedVariableTokenBalance, termStartTimestamp, termEndTimestamp, isLM, historicalApy, blockTimestampScaled);

    }
  } else if (currentTick < tickUpper) {
    console.log("TESTTTTTT: currentTick < tickUpper");
    return positionMarginBetweenTicksHelper(tickLower, tickUpper, isLM, currentTick, termStartTimestamp, termEndTimestamp, liquidity, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, blockTimestampScaled);
  } else {
    console.log("TESTTTTTT: currentTick >= tickLower");
    if (variableTokenBalance.lt(toBn("0.0"))) {
      throw new Error('varible balance < 0');
    } else if (variableTokenBalance.gt(toBn("0.0"))) {
      return getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM, historicalApy, blockTimestampScaled);
    } else {
      let amount0JSBI = SqrtPriceMath.getAmount0Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        true
      );
    
      let amount1JSBI = SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(tickLower),
        TickMath.getSqrtRatioAtTick(tickUpper),
        liquidity,
        false
      );
    
      let amount0 = BigNumber.from(amount0JSBI.toString());
      let amount1 = BigNumber.from(amount1JSBI.toString());
    
      amount1 = mul(amount1, toBn("-1.0"));

      const expectedVariableTokenBalance = amount1;
      const expectedFixedTokenbalance = getFixedTokenBalance(amount0, amount1, variableFactor, termStartTimestamp, termEndTimestamp);

      return getTraderMarginRequirement(expectedFixedTokenbalance, expectedVariableTokenBalance, termStartTimestamp, termEndTimestamp, isLM, historicalApy, blockTimestampScaled);
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

  let amount0UpJSBI = SqrtPriceMath.getAmount0Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickUpper),
    liquidity,
    true
  );

  let amount1UpJSBI = SqrtPriceMath.getAmount1Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickUpper),
    liquidity,
    false
  );

  let amount0Up = BigNumber.from(amount0UpJSBI.toString());
  let amount1Up = BigNumber.from(amount1UpJSBI.toString());

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
    historicalApy,
    blockTimestampScaled
  );

  let amount0DownJSBI = SqrtPriceMath.getAmount0Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickLower),
    liquidity,
    false
  );

  let amount1DownJSBI = SqrtPriceMath.getAmount1Delta(
    TickMath.getSqrtRatioAtTick(currentTick),
    TickMath.getSqrtRatioAtTick(tickLower),
    liquidity,
    true
  );

  let amount0Down = BigNumber.from(amount0DownJSBI.toString());
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
    worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, termEndTimestamp, blockTimestampScaled, isFT, isLM, historicalApy)
  );

  const modelMargin = add(exp1, exp2);
  const minimumMargin = getMinimumMarginRequirement(
    fixedTokenBalance,
    variableTokenBalance,
    termStartTimestamp,
    termEndTimestamp,
    isLM,
    historicalApy
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
    apyBound = computeApyBound(termEndTimestampScaled, currentTimestampScaled, historicalApy, true);
    if (isLM) {
      variableFactor = mul(timeInYearsFromStartUntilMaturity, apyBound);
    } else {
      variableFactor = mul(
        timeInYearsFromStartUntilMaturity,
        mul(apyBound, APY_UPPER_MULTIPLIER)
      );
    }
  } else {;
    apyBound = computeApyBound(termEndTimestampScaled, currentTimestampScaled, historicalApy, false);
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
  const timeFactor = computeTimeFactor(BETA, termEndTimestampScaled, currentTimestampScaled);
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
  isLM: boolean,
  historicalApy: BigNumber
) {
  // historicalApy is not necessary for this calculation

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
  let calculatorTest: MarginCalculatorTest;

  const fixture = async () => {
    const timeFactory = await ethers.getContractFactory("Time");

    const timeLibrary = await timeFactory.deploy();

    const { factory } = await factoryFixture(timeLibrary);

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
      "MarginCalculatorTest",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Time: timeLibrary.address,
        },
      }
    );

    return (await marginCalculator.deploy(
      factory.address
    )) as MarginCalculatorTest;
  };

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("MarginCalculator Parameters", async () => {

    beforeEach("deploy calculator", async () => {
      calculatorTest = await loadFixture(fixture);
    });

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
        XI_LOWER,
        T_MAX
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
      expect(marginCalculatorParameters[10]).to.eq(T_MAX);
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
          isLM,
          historicalApy
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await calculatorTest.getMinimumMarginRequirementTest(
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
          isLM,
          historicalApy
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await calculatorTest.getMinimumMarginRequirementTest(
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
          isLM,
          historicalApy
        ); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
      const realisedMinimumMarginRequirement: BigNumber =
        await calculatorTest.getMinimumMarginRequirementTest(
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
        XI_LOWER,
        T_MAX
      );
    });

    it("reverts if termEndTimestamp isn't > 0", async () => {
      await expect(
        calculatorTest.computeTimeFactorTest(
          RATE_ORACLE_ID,
          toBn("0"),
          toBn("1")
        )
      ).to.be.revertedWith("termEndTimestamp must be > 0");
    });

    it("reverts if currentTimestamp is larger than termEndTimestamp", async () => {
      await expect(
        calculatorTest.computeTimeFactorTest(
          RATE_ORACLE_ID,
          toBn("1"),
          toBn("2")
        )
      ).to.be.revertedWith("endTime must be > currentTime");
    });

    it("reverts if given invalid rateOracleId", async () => {
      await expect(
        calculatorTest.computeTimeFactorTest(
          utils.formatBytes32String("unknownOracle"),
          toBn("0"),
          toBn("1")
        )
      ).to.be.revertedWith("termEndTimestamp must be > 0");
    });

    it("correctly computes the time factor", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp+604800).toString() // add a week
      );

      const expected = computeTimeFactor(
        BETA,
        termEndTimestampScaled,
        toBn(currentTimestamp.toString())
      );

      const realized = await calculatorTest.computeTimeFactorTest(
        RATE_ORACLE_ID,
        termEndTimestampScaled,
        toBn(currentTimestamp.toString())
      )

      expect(
        realized
      ).to.be.closeTo(expected, 100);


    });

  });

  describe("#computeApyBound", async () => {
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
        XI_LOWER,
        T_MAX
      );
    });

    // passes
    it("correctly computes the Upper APY Bound", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp+604800).toString() // add a week
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
        await calculatorTest.computeApyBoundTest(
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
        (currentTimestamp+604800).toString() // add a week
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
        await calculatorTest.computeApyBoundTest(
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
        XI_LOWER,
        T_MAX
      );
    });

    it("returns zero if position isn't settled", async () => {
      const fixedTokenBalance: BigNumber = toBn("10000");
      const variableTokenBalance: BigNumber = toBn("1000");

      expect(
        await calculatorTest.getTraderMarginRequirementTest(
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
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly calculates the worst case variable factor at maturity FT, LM", async () => {

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp+604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600") // two weeks
      const isFT = true;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, historicalApy)

      const realized = await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, RATE_ORACLE_ID, historicalApy);

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);

    })

    it("correctly calculates the worst case variable factor at maturity FT, IM", async () => {

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp+604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600") // two weeks
      const isFT = true;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, historicalApy)

      const realized = await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, RATE_ORACLE_ID, historicalApy);

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);

    })

    it("correctly calculates the worst case variable factor at maturity VT, LM", async () => {

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp+604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600") // two weeks
      const isFT = false;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, historicalApy)

      const realized = await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, RATE_ORACLE_ID, historicalApy);

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);

    })

    it("correctly calculates the worst case variable factor at maturity VT, IM", async () => {

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp+604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600") // two weeks
      const isFT = false;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, historicalApy)

      const realized = await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturityBN, termEndTimestampScaled, currentTimestampScaled, isFT, isLM, RATE_ORACLE_ID, historicalApy);

      // expect(realized).to.eq(expected);
      expect(realized).to.be.closeTo(expected, 100);

    })


  })

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
        XI_LOWER,
        T_MAX
      );
    });


    it("correctly calculates the trader margin requirement: FT, LM", async () => {
    
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      // const isFT = true;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized = await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, RATE_ORACLE_ID, historicalApy);

      const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, historicalApy, currentTimestampScaled);
        
      expect(realized).to.be.closeTo(expected, 100);

    })

    it("correctly calculates the trader margin requirement: FT, IM", async () => {
    
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized = await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, RATE_ORACLE_ID, historicalApy);

      const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, historicalApy, currentTimestampScaled);
        
      expect(realized).to.be.closeTo(expected, 100);

    })

    it("correctly calculates the trader margin requirement: VT, LM", async () => {
    
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const isLM = true;
      const historicalApy = toBn("0.1");

      const realized = await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, RATE_ORACLE_ID, historicalApy);

      const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, historicalApy, currentTimestampScaled);
        
      expect(realized).to.be.closeTo(expected, 100);

    })


    it("correctly calculates the trader margin requirement: VT, IM", async () => {
    
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized = await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, RATE_ORACLE_ID, historicalApy);

      const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampScaled, termEndTimestampScaled, isLM, historicalApy, currentTimestampScaled);
        
      expect(realized).to.be.closeTo(expected, 100);

    })


  })


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
        XI_LOWER,
        T_MAX
      );
    });


    it("correctly calculates positionMarginBetweenTicks (current tick is 0), LM, (-1, 1)", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = 0;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized = await calculatorTest.positionMarginBetweenTicksHelperTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy);

      const expected = positionMarginBetweenTicksHelper(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityJSBI, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, currentTimestampScaled);
        
      console.log("TESTTT: realised", realized.toString());
      console.log("TESTTT: expected", expected.toString());

      expect(realized).to.be.closeTo(expected, 10000000000000);

    })

    it("correctly calculates positionMarginBetweenTicks (current tick is -1), LM, (-1, 1)", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = -1;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized = await calculatorTest.positionMarginBetweenTicksHelperTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy);

      const expected = positionMarginBetweenTicksHelper(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityJSBI, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, currentTimestampScaled);
      
      expect(realized).to.be.closeTo(expected, 10000000000000);

    })

    it("correctly calculates positionMarginBetweenTicks (current tick is -1), LM, (-1, 1), starting fixed and variable balances are 0", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = -1;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized = await calculatorTest.positionMarginBetweenTicksHelperTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy);

      const expected = positionMarginBetweenTicksHelper(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityJSBI, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, currentTimestampScaled);
      
      expect(realized).to.be.closeTo(expected, 10000000000000);

    })

    it("reverts positionMarginBetweenTicks (current tick is -10), LM, (-1, 1)", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = -10;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      // const realized = await calculatorTest.positionMarginBetweenTicksHelperTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy);
      await expect(calculatorTest.positionMarginBetweenTicksHelperTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy)).to.be.revertedWith("currentTick >= tickLower");

      // const expected = positionMarginBetweenTicksHelper(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityJSBI, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, currentTimestampScaled);
      
      // expect(realized).to.be.closeTo(expected, 10000);

    })

    it("reverts positionMarginBetweenTicks (current tick is -10), IM, (-1, 1)", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = false;
      const currentTick: number = -10;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      await expect(calculatorTest.positionMarginBetweenTicksHelperTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy)).to.be.revertedWith("currentTick >= tickLower");

      // const expected = positionMarginBetweenTicksHelper(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityJSBI, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, currentTimestampScaled);
      
      // expect(realized).to.be.closeTo(expected, 10000000); // error delta is higher

    })

  })


  describe("#getPositionMarginRequirement", async () => {
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
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly calculates positionMargin (current tick is 0), LM, (-1, 1)", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = 0;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

      const realized = await calculatorTest.getPositionMarginRequirementTest(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy);
      
      console.log("Realised is: ", realized.toString());

      const expected = getPositionMarginRequirement(tickLower, tickUpper, isLM, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityJSBI, fixedTokenBalance, variableTokenBalance, variableFactor, historicalApy, currentTimestampScaled);
      
      console.log("Expected is: ", expected.toString());

      expect(realized).to.be.closeTo(expected, 10000000000000);

    })

  })


  describe("#isLiquiisLiquidatableTrader", async () => {
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
        XI_LOWER,
        T_MAX
      );
    });


    it("correctly checks for the fact the trader is liquidatable", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      // const isFT = true;
      const isLM = false;
      const historicalApy = toBn("0.1");
      const currentMargin = toBn("0.0");

      const realized = await calculatorTest.isLiquidatableTraderTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestampScaled, isLM, RATE_ORACLE_ID, historicalApy, currentMargin);
      expect(realized).to.be.eq(true);

    })


  })

  describe("#isLiquiisLiquidatablePosition", async () => {
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
        XI_LOWER,
        T_MAX
      );
    });

    it("correctly checks for the fact the position is liquidatable", async () => {

      const tickLower: number = -1;
      const tickUpper: number = 1;
      const isLM: boolean = true;
      const currentTick: number = 0;

      const currentTimestamp = await getCurrentTimestamp(provider) + 1;
      const currentTimestampScaled = toBn(currentTimestamp.toString())
      
      const termStartTimestamp = currentTimestamp - 604800;

      const termEndTimestampScaled = toBn(
        (termStartTimestamp+604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(termStartTimestamp.toString());

      const fixedTokenBalance: BigNumber = toBn("-3000");
      const variableTokenBalance: BigNumber = toBn("1000");

      const variableFactor: BigNumber = toBn("0.02");
      const historicalApy: BigNumber = toBn("0.3");
      const liquidityBN: BigNumber = expandTo18Decimals(1);
      const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());
      const currentMargin = toBn("0.0");

      const realized = await calculatorTest.isLiquidatablePositionLMTest(tickLower, tickUpper, currentTick, termStartTimestampScaled, termEndTimestampScaled, liquidityBN, fixedTokenBalance, variableTokenBalance, variableFactor, RATE_ORACLE_ID, historicalApy, currentMargin);
      
      expect(realized).to.eq(true);

    })


  })

});
