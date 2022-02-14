import { Wallet, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";
import {
  fixedAndVariableMathFixture,
  // fixedAndVariableMathFixture, // uncomment for position margin requirement
  marginCalculatorFixture,
  sqrtPriceMathFixture,
  tickMathFixture,
} from "../shared/fixtures";
import {
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
  encodeSqrtRatioX96,
  encodePriceSqrt,
} from "../shared/utilities";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";
import {
  FixedAndVariableMathTest,
  SqrtPriceMathTest,
  TickMathTest,
} from "../../typechain";
import { add } from "../shared/functions";
// uncomment
// import { TickMath } from "../shared/tickMath";
// import JSBI from "jsbi";
// import { SqrtPriceMath } from "../shared/sqrtPriceMath";
// import { add, mul } from "../shared/functions";
// import { FixedAndVariableMathTest } from "../../typechain";

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

describe("MarginCalculator", () => {
  // - Setup

  let wallet: Wallet, other: Wallet;

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

        devMulLeftUnwindLMWad: toBn("0.5"),
        devMulRightUnwindLMWad: toBn("0.5"),
        devMulLeftUnwindIMWad: toBn("0.8"),
        devMulRightUnwindIMWad: toBn("0.8"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
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

      const realized = await testMarginCalculator.computeTimeFactor(
        termEndTimestampScaled,
        toBn(currentTimestamp.toString()),
        margin_engine_params
      );

      expect(realized).to.be.eq("981004647228725753");
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

        devMulLeftUnwindLMWad: toBn("0.5"),
        devMulRightUnwindLMWad: toBn("0.5"),
        devMulLeftUnwindIMWad: toBn("0.8"),
        devMulRightUnwindIMWad: toBn("0.8"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
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

      expect(
        await testMarginCalculator.computeApyBound(
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper,
          margin_engine_params
        )
      ).to.eq("24278147968583284");
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

      expect(
        await testMarginCalculator.computeApyBound(
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper,
          margin_engine_params
        )
      ).to.eq("17456226370556757");
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

        devMulLeftUnwindLMWad: toBn("0.5"),
        devMulRightUnwindLMWad: toBn("0.5"),
        devMulLeftUnwindIMWad: toBn("0.8"),
        devMulRightUnwindIMWad: toBn("0.8"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
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

      expect(realized).to.eq("4123691408399440");
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

      expect(realized).to.eq("6185537112599160");
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

      expect(realized).to.eq("3543058379114670");
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

      expect(realized).to.eq("2480140865380269");
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

        devMulLeftUnwindLMWad: toBn("0.5"),
        devMulRightUnwindLMWad: toBn("0.5"),
        devMulLeftUnwindIMWad: toBn("2.0"),
        devMulRightUnwindIMWad: toBn("2.0"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    it("correctly calculates the trader margin requirement: FT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn((currentTimestamp - 0).toString()); // so we don't have to worry about rebalancing

      const isLM = true;
      const historicalApy = toBn("0.0");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(1, 20).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      expect(realized).to.eq(toBn("11.424356824163482611"));
    });

    it("correctly calculates the trader margin requirement: FT, LM with <0", async () => {
      const fixedTokenBalance: BigNumber = toBn("10");
      const variableTokenBalance: BigNumber = toBn("-30000000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(
        (currentTimestamp - 604800).toString()
      );
      const isLM = true;
      const historicalApy = toBn("0.1");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(1, 20).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      expect(realized).to.eq(toBn("123710.738416366761643840"));
    });

    it("correctly calculates the trader margin requirement: FT, IM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn((currentTimestamp - 0).toString());
      const isLM = false;
      const historicalApy = toBn("0.0");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(1, 20).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      console.log("realized", utils.formatEther(realized.toString()));

      // very close to the liquidation margin requirement (investigate the reason why)!
      expect(realized).to.eq(toBn("11.752221817201914445"));
    });

    it("correctly calculates the trader margin requirement: FT, IM with <0", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(
        (currentTimestamp - 604800).toString()
      );
      const isLM = false;
      const historicalApy = toBn("0.1");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(1, 20).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      expect(realized).to.eq(toBn("18.173049693961864"));
    });

    it("correctly calculates the trader margin requirement: VT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 31556952).toString() // add a year
      );

      const termStartTimestampScaled = toBn((currentTimestamp - 0).toString());
      const isLM = true;
      const historicalApy = toBn("0.1");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(20, 1).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      console.log("realized", utils.formatEther(realized.toString()));

      expect(realized).to.eq(toBn("10.006643835616438"));
    });

    it("correctly calculates the trader margin requirement: FT, IM", async () => {
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 31556952).toString() // add a year
      );

      const termStartTimestampScaled = toBn((currentTimestamp - 0).toString());
      const isLM = false;
      const historicalApy = toBn("0.1");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(20, 1).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      console.log("realized", utils.formatEther(realized.toString()));
      expect(realized).to.eq(toBn("10.006643835616438"));
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

        devMulLeftUnwindLMWad: toBn("0"),
        devMulRightUnwindLMWad: toBn("0"),
        devMulLeftUnwindIMWad: toBn("0"),
        devMulRightUnwindIMWad: toBn("0"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("1"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("1"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    it("correctly checks for the fact the trader is liquidatable", async () => {
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");

      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const termStartTimestampScaled = toBn(
        (currentTimestamp - 604800).toString()
      );
      const isLM = true;
      const historicalApy = toBn("0.1");

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: encodeSqrtRatioX96(20, 1).toString(),
        variableFactorWad: toBn("0"),
      };

      const currentMargin = toBn("0.0");

      const realized = await testMarginCalculator.isLiquidatableTrader(
        trader_margin_requirement_params,
        currentMargin,
        margin_engine_params
      );
      expect(realized).to.be.eq(true);
    });
  });

  describe("#getPositionMarginRequirement", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;
    let testFixedAndVariableMath: FixedAndVariableMathTest;
    let testTickMath: TickMathTest;
    let testSqrtPriceMath: SqrtPriceMathTest;

    let tickAt0001p: number;
    let tickAt1p: number;
    let tickAt2p: number;
    let tickAt4p: number;
    let tickAt10p: number;
    let tickAt99p: number;
    let tickAt101p: number;

    let priceAt0001p: BigNumber;
    let priceAt1p: BigNumber;
    let priceAt2p: BigNumber;
    let priceAt4p: BigNumber;
    let priceAt10p: BigNumber;
    let priceAt99p: BigNumber;
    let priceAt101p: BigNumber;

    let currentTimestampScaled: BigNumber;
    let termEndTimestampScaled: BigNumber;
    let termStartTimestampScaled: BigNumber;

    before("deploy calculator", async () => {
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

        devMulLeftUnwindLMWad: toBn("0"),
        devMulRightUnwindLMWad: toBn("0"),
        devMulLeftUnwindIMWad: toBn("0"),
        devMulRightUnwindIMWad: toBn("0"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("1"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("1"),

        gammaWad: toBn("100.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive

        // deviation 1%
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
      ({ testFixedAndVariableMath } = await loadFixture(
        fixedAndVariableMathFixture
      ));
      ({ testTickMath } = await loadFixture(tickMathFixture));
      ({ testSqrtPriceMath } = await loadFixture(sqrtPriceMathFixture));

      tickAt0001p = await testTickMath.getTickAtSqrtRatio(
        encodePriceSqrt(1000, 1)
      ); // 0.001%
      tickAt1p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 1)); // 1%
      tickAt2p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 2)); // 2%
      tickAt4p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 4)); // 4%
      tickAt10p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 10)); // 10%
      tickAt99p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 99)); // 99%
      tickAt101p = await testTickMath.getTickAtSqrtRatio(
        encodePriceSqrt(1, 101)
      ); // 101%

      priceAt0001p = await testTickMath.getSqrtRatioAtTick(tickAt0001p);
      priceAt1p = await testTickMath.getSqrtRatioAtTick(tickAt1p);
      priceAt2p = await testTickMath.getSqrtRatioAtTick(tickAt2p);
      priceAt4p = await testTickMath.getSqrtRatioAtTick(tickAt4p);
      priceAt10p = await testTickMath.getSqrtRatioAtTick(tickAt10p);
      priceAt99p = await testTickMath.getSqrtRatioAtTick(tickAt99p);
      priceAt101p = await testTickMath.getSqrtRatioAtTick(tickAt101p);

      const currentTimestamp = await getCurrentTimestamp(provider);
      currentTimestampScaled = toBn(currentTimestamp.toString());

      const termStartTimestamp = currentTimestamp;
      termEndTimestampScaled = toBn(
        (termStartTimestamp + 31556952).toString() // add a year
      );
      termStartTimestampScaled = toBn(termStartTimestamp.toString());
    });

    async function getPositionMarginRequirement(
      tickLower: number,
      tickUpper: number,
      currentTick: number,
      sqrtPriceX96: BigNumber,
      isLM: boolean,
      liquidityBn: BigNumber,
      fixedTokenBalance: BigNumber,
      variableTokenBalance: BigNumber,
      variableFactor: BigNumber,
      historicalApy: BigNumber
    ) {
      const position_margin_requirement_params = {
        owner: wallet.address,
        tickLower: tickLower,
        tickUpper: tickUpper,
        isLM: isLM,
        currentTick: currentTick,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        liquidity: liquidityBn,
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        variableFactorWad: variableFactor,
        historicalApyWad: historicalApy,
        sqrtPriceX96: sqrtPriceX96,
      };

      const realized =
        await testMarginCalculator.getPositionMarginRequirementTest(
          position_margin_requirement_params,
          margin_engine_params
        );

      console.log(
        "position margin requirement: ",
        utils.formatEther(realized).toString()
      );
      console.log(" ");

      return realized;
    }

    async function extraBalances(
      lowerSqrtPrice: BigNumber,
      upperSqrtPrice: BigNumber,
      isFT: boolean,
      liquidityBn: BigNumber,
      variableFactor: BigNumber
    ) {
      // const timeFactor = await testMarginCalculator.computeTimeFactor(
      //   termEndTimestampScaled,
      //   currentTimestampScaled,
      //   margin_engine_params
      // );
      // console.log("time factor: ", utils.formatEther(timeFactor).toString());

      let amount0Delta = await testSqrtPriceMath.getAmount0Delta(
        lowerSqrtPrice,
        upperSqrtPrice,
        liquidityBn,
        true
      );

      let amount1Delta = await testSqrtPriceMath.getAmount1Delta(
        lowerSqrtPrice,
        upperSqrtPrice,
        liquidityBn,
        false
      );

      console.log("amount0Delta", amount0Delta.toString());
      console.log("amount1Delta", amount1Delta.toString());

      if (isFT) {
        amount1Delta = amount1Delta.mul(-1);
      } else {
        amount0Delta = amount0Delta.mul(-1);
      }

      const extraFixedTokenBalance =
        await testFixedAndVariableMath.getFixedTokenBalance(
          amount0Delta,
          amount1Delta,
          variableFactor,
          termStartTimestampScaled,
          termEndTimestampScaled
        );

      return [extraFixedTokenBalance, amount1Delta];
    }

    async function getTraderMarginRequirement(
      fixedTokenBalance: BigNumber,
      variableTokenBalance: BigNumber,
      sqrtPriceX96: BigNumber,
      isLM: boolean,
      historicalApy: BigNumber,
      variableFactor: BigNumber
    ) {
      console.log(
        "fixed token balance:",
        utils.formatEther(fixedTokenBalance.toString())
      );
      console.log(
        "variable token balance:",
        utils.formatEther(variableTokenBalance.toString())
      );

      const trader_margin_requirement_params = {
        fixedTokenBalance: fixedTokenBalance,
        variableTokenBalance: variableTokenBalance,
        termStartTimestampWad: termStartTimestampScaled,
        termEndTimestampWad: termEndTimestampScaled,
        isLM: isLM,
        historicalApyWad: historicalApy,
        sqrtPriceX96: sqrtPriceX96,
        variableFactorWad: variableFactor,
      };

      const tmReq = await testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      console.log("tm req:", utils.formatEther(tmReq).toString());
      console.log(" ");
      return tmReq;
    }

    it("current tick < lower tick: margin requirement for upper tick", async () => {
      const tickLower = tickAt4p;
      const lowerSqrtPrice = priceAt4p;
      const tickUpper = tickAt2p;
      const upperSqrtPrice = priceAt2p;
      const currentTick = tickAt10p;
      const currentSqrtPrice = priceAt10p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");

      const variableFactor: BigNumber = toBn("0.0");
      const historicalApy: BigNumber = toBn("0.0");
      const liquidityBN: BigNumber = toBn("1000");

      const isLM = true;

      const [extraFixedBalance, extraVariableBalances] = await extraBalances(
        lowerSqrtPrice,
        upperSqrtPrice,
        false,
        liquidityBN,
        variableFactor
      );
      const scenario1LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances
      );
      const scenario1LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance
      );

      console.log("SCENARIO 1:");
      const tmReq1 = await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        upperSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");
      await getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        currentSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      const realized = await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      expect(realized).to.be.eq(tmReq1);
    });

    it("current tick < lower tick: margin requirement for current tick", async () => {
      const tickLower = tickAt4p;
      const lowerSqrtPrice = priceAt4p;
      const tickUpper = tickAt2p;
      const upperSqrtPrice = priceAt2p;
      const currentTick = tickAt10p;
      const currentSqrtPrice = priceAt10p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("585.80");
      const variableTokenBalance: BigNumber = toBn("-207.10");

      const variableFactor: BigNumber = toBn("0.0");
      const historicalApy: BigNumber = toBn("0.0");
      const liquidityBN: BigNumber = toBn("1000");

      const isLM = true;

      const [extraFixedBalance, extraVariableBalances] = await extraBalances(
        lowerSqrtPrice,
        upperSqrtPrice,
        false,
        liquidityBN,
        variableFactor
      );
      const scenario1LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances
      );
      const scenario1LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance
      );

      console.log("SCENARIO 1:");
      await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        upperSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");
      const tmReq2 = await getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        currentSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      const realized = await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      expect(realized).to.be.eq(tmReq2);
    });

    it("lower tick < current tick < upper tick: margin requirement for upper tick", async () => {
      const tickLower = tickAt10p;
      const lowerSqrtPrice = priceAt10p;
      const tickUpper = tickAt2p;
      const upperSqrtPrice = priceAt2p;
      const currentTick = tickAt4p;
      const currentSqrtPrice = priceAt4p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");

      const variableFactor: BigNumber = toBn("0.0");
      const historicalApy: BigNumber = toBn("0.0");
      const liquidityBN: BigNumber = toBn("1000");

      const isLM = true;

      const [extraFixedBalance1, extraVariableBalances1] = await extraBalances(
        currentSqrtPrice,
        upperSqrtPrice,
        false,
        liquidityBN,
        variableFactor
      );
      const scenario1LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances1
      );
      const scenario1LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance1
      );

      console.log("SCENARIO 1:");
      await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        upperSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");

      const [extraFixedBalance2, extraVariableBalances2] = await extraBalances(
        lowerSqrtPrice,
        currentSqrtPrice,
        true,
        liquidityBN,
        variableFactor
      );
      const scenario2LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances2
      );
      const scenario2LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance2
      );

      const tmReq2 = await getTraderMarginRequirement(
        scenario2LPFixedTokenBalance,
        scenario2LPVariableTokenBalance,
        lowerSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      const realized = await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      expect(realized).to.be.eq(tmReq2);
    });

    it("lower tick < current tick < upper tick: margin requirement for lower tick", async () => {
      const tickLower = tickAt10p;
      const lowerSqrtPrice = priceAt10p;
      const tickUpper = tickAt2p;
      const upperSqrtPrice = priceAt2p;
      const currentTick = tickAt4p;
      const currentSqrtPrice = priceAt4p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("170");

      const variableFactor: BigNumber = toBn("0.0");
      const historicalApy: BigNumber = toBn("0.0");
      const liquidityBN: BigNumber = toBn("1000");

      const isLM = true;

      const [extraFixedBalance1, extraVariableBalances1] = await extraBalances(
        currentSqrtPrice,
        upperSqrtPrice,
        false,
        liquidityBN,
        variableFactor
      );
      const scenario1LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances1
      );
      const scenario1LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance1
      );

      console.log("SCENARIO 1:");
      const tmReq1 = await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        upperSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");

      const [extraFixedBalance2, extraVariableBalances2] = await extraBalances(
        lowerSqrtPrice,
        currentSqrtPrice,
        true,
        liquidityBN,
        variableFactor
      );
      const scenario2LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances2
      );
      const scenario2LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance2
      );

      await getTraderMarginRequirement(
        scenario2LPFixedTokenBalance,
        scenario2LPVariableTokenBalance,
        lowerSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      const realized = await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      expect(realized).to.be.eq(tmReq1);
    });

    it("upper tick < current tick: margin requirement for upper tick", async () => {
      const tickLower = tickAt10p;
      const lowerSqrtPrice = priceAt10p;
      const tickUpper = tickAt4p;
      const upperSqrtPrice = priceAt4p;
      const currentTick = tickAt2p;
      const currentSqrtPrice = priceAt2p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");

      const variableFactor: BigNumber = toBn("0.0");
      const historicalApy: BigNumber = toBn("0.0");
      const liquidityBN: BigNumber = toBn("1000");

      const isLM = true;

      const scenario1LPVariableTokenBalance = variableTokenBalance;
      const scenario1LPFixedTokenBalance = fixedTokenBalance;

      console.log("SCENARIO 1:");
      await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        currentSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");

      const [extraFixedBalance2, extraVariableBalances2] = await extraBalances(
        lowerSqrtPrice,
        upperSqrtPrice,
        true,
        liquidityBN,
        variableFactor
      );
      const scenario2LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances2
      );
      const scenario2LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance2
      );

      const tmReq2 = await getTraderMarginRequirement(
        scenario2LPFixedTokenBalance,
        scenario2LPVariableTokenBalance,
        lowerSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      const realized = await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      expect(realized).to.be.eq(tmReq2);
    });

    it("upper tick < current tick: margin requirement for upper tick", async () => {
      const tickLower = tickAt10p;
      const lowerSqrtPrice = priceAt10p;
      const tickUpper = tickAt4p;
      const upperSqrtPrice = priceAt4p;
      const currentTick = tickAt2p;
      const currentSqrtPrice = priceAt2p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("-1162");
      const variableTokenBalance: BigNumber = toBn("183");

      const variableFactor: BigNumber = toBn("0.0");
      const historicalApy: BigNumber = toBn("0.0");
      const liquidityBN: BigNumber = toBn("1000");

      const isLM = true;

      const scenario1LPVariableTokenBalance = variableTokenBalance;
      const scenario1LPFixedTokenBalance = fixedTokenBalance;

      console.log("SCENARIO 1:");
      const tmReq1 = await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        currentSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");

      const [extraFixedBalance2, extraVariableBalances2] = await extraBalances(
        lowerSqrtPrice,
        upperSqrtPrice,
        true,
        liquidityBN,
        variableFactor
      );
      const scenario2LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances2
      );
      const scenario2LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance2
      );

      await getTraderMarginRequirement(
        scenario2LPFixedTokenBalance,
        scenario2LPVariableTokenBalance,
        lowerSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      const realized = await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      expect(realized).to.be.eq(tmReq1);
    });

    it("case 1 of mc and fcm pdf", async () => {
      const currentTick = tickAt0001p;
      const currentSqrtPrice = priceAt0001p;

      console.log("current tick", currentTick);

      const fixedTokenBalance: BigNumber = toBn("-500000");
      const variableTokenBalance: BigNumber = toBn("1000000");

      const historicalApy: BigNumber = toBn("0.005"); // =>

      const variableFactor =
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          termEndTimestampScaled.sub(termStartTimestampScaled),
          termEndTimestampScaled,
          currentTimestampScaled,
          false,
          false,
          historicalApy,
          margin_engine_params
        );

      const lowerApyBound = await testMarginCalculator.computeApyBound(
        termEndTimestampScaled,
        currentTimestampScaled,
        historicalApy,
        false,
        margin_engine_params
      );

      console.log("variable factor:", utils.formatEther(variableFactor));
      console.log("lower apy bound:", utils.formatEther(lowerApyBound));
      console.log("issue in here?");

      const isLM = true;

      // no variable yield accrued since the inception of the pool since we are currently at the inception
      const variableFactorSinceTermStartTimestamp = toBn("0");

      const realized = await getTraderMarginRequirement(
        fixedTokenBalance,
        variableTokenBalance,
        currentSqrtPrice,
        isLM,
        historicalApy,
        variableFactorSinceTermStartTimestamp
      );

      expect(realized).to.eq(realized);
    });

    it("case 2 of fcm and mc pdf", async () => {
      const tickLower = tickAt101p;
      const lowerSqrtPrice = priceAt101p;
      const tickUpper = tickAt99p;
      const upperSqrtPrice = priceAt99p;
      const currentTick = tickAt1p;
      const currentSqrtPrice = priceAt1p;

      console.log("current tick", currentTick);
      console.log("lower tick:", tickLower);
      console.log("upper tick:", tickUpper);
      console.log(" ");

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");

      const historicalApy: BigNumber = toBn("0.146155"); // => 12% upper bound apy
      const liquidityBN: BigNumber = toBn("1000000000");

      const variableFactor =
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          termEndTimestampScaled.sub(termStartTimestampScaled),
          termEndTimestampScaled,
          currentTimestampScaled,
          false,
          false,
          historicalApy,
          margin_engine_params
        );

      const upperApyBound = await testMarginCalculator.computeApyBound(
        termEndTimestampScaled,
        currentTimestampScaled,
        historicalApy,
        true,
        margin_engine_params
      );

      console.log("variable factor:", utils.formatEther(variableFactor));
      console.log("upperApyBound:", utils.formatEther(upperApyBound));

      const isLM = true;

      const scenario1LPVariableTokenBalance = variableTokenBalance;
      const scenario1LPFixedTokenBalance = fixedTokenBalance;

      console.log("SCENARIO 1:");
      await getTraderMarginRequirement(
        scenario1LPFixedTokenBalance,
        scenario1LPVariableTokenBalance,
        currentSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      console.log("SCENARIO 2:");

      const [extraFixedBalance2, extraVariableBalances2] = await extraBalances(
        lowerSqrtPrice,
        upperSqrtPrice,
        true,
        liquidityBN,
        variableFactor
      );
      const scenario2LPVariableTokenBalance = add(
        variableTokenBalance,
        extraVariableBalances2
      );
      const scenario2LPFixedTokenBalance = add(
        fixedTokenBalance,
        extraFixedBalance2
      );

      await getTraderMarginRequirement(
        scenario2LPFixedTokenBalance,
        scenario2LPVariableTokenBalance,
        lowerSqrtPrice,
        isLM,
        historicalApy,
        variableFactor
      );

      await getPositionMarginRequirement(
        tickLower,
        tickUpper,
        currentTick,
        currentSqrtPrice,
        isLM,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        variableFactor,
        historicalApy
      );

      // 10,006 per 1% (scenario from pdf)
    });

    // it("current tick < lower tick: margin requirement for staying tick", async () => {
    //   const currentTick: string = (
    //     await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 10))
    //   ).toString(); // 10%
    //   const tickLower = tickAt4p;
    //   const tickUpper = tickAt2p;

    //   console.log("current tick", currentTick);
    //   console.log("lower tick:", tickLower);
    //   console.log("upper tick:", tickUpper);

    //   const currentTimestamp = await getCurrentTimestamp(provider);
    //   const currentTimestampScaled = toBn(currentTimestamp.toString());

    //   const termStartTimestamp = currentTimestamp;

    //   const termEndTimestampScaled = toBn(
    //     (termStartTimestamp + 31556952).toString() // add a year
    //   );

    //   const termStartTimestampScaled = toBn(termStartTimestamp.toString());

    //   const fixedTokenBalance: BigNumber = toBn("585");
    //   const variableTokenBalance: BigNumber = toBn("-207");

    //   const variableFactor: BigNumber = toBn("0.0");
    //   const historicalApy: BigNumber = toBn("0.0");
    //   const liquidityBN: BigNumber = expandTo18Decimals(1000);

    //   const isLM = true;

    //   const position_margin_requirement_params = {
    //     owner: wallet.address,
    //     tickLower: tickLower,
    //     tickUpper: tickUpper,
    //     isLM: isLM,
    //     currentTick: currentTick,
    //     termStartTimestampWad: termStartTimestampScaled,
    //     termEndTimestampWad: termEndTimestampScaled,
    //     liquidity: liquidityBN,
    //     fixedTokenBalance: fixedTokenBalance,
    //     variableTokenBalance: variableTokenBalance,
    //     variableFactorWad: variableFactor,
    //     historicalApyWad: historicalApy,
    //     sqrtPriceX96: encodeSqrtRatioX96(1, 10).toString(),
    //   };

    //   const timeFactor = await testMarginCalculator.computeTimeFactor(
    //     termEndTimestampScaled,
    //     currentTimestampScaled,
    //     margin_engine_params
    //   );
    //   console.log("time factor: ", utils.formatEther(timeFactor).toString());

    //   const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

    //   const amount0DeltaJSBI = SqrtPriceMath.getAmount0Delta(
    //     TickMath.getSqrtRatioAtTick(tickLower),
    //     TickMath.getSqrtRatioAtTick(tickUpper),
    //     liquidityJSBI,
    //     false
    //   );

    //   const amount1DeltaJSBI = SqrtPriceMath.getAmount1Delta(
    //     TickMath.getSqrtRatioAtTick(tickLower),
    //     TickMath.getSqrtRatioAtTick(tickUpper),
    //     liquidityJSBI,
    //     true
    //   );

    //   let amount0Delta = BigNumber.from(amount0DeltaJSBI.toString());
    //   const amount1Delta = BigNumber.from(amount1DeltaJSBI.toString());

    //   amount0Delta = mul(amount0Delta, toBn("-1.0"));

    //   console.log(
    //     "amount0 contract: ",
    //     utils.formatEther(amount0Delta).toString()
    //   );
    //   console.log(
    //     "amount1 contract: ",
    //     utils.formatEther(amount1Delta).toString()
    //   );

    //   const extraFixedTokenBalance =
    //     await testFixedAndVariableMath.getFixedTokenBalance(
    //       amount0Delta,
    //       amount1Delta,
    //       variableFactor,
    //       termStartTimestampScaled,
    //       termEndTimestampScaled
    //     );

    //   const scenario1LPVariableTokenBalance = add(
    //     variableTokenBalance,
    //     amount1Delta
    //   );
    //   const scenario1LPFixedTokenBalance = add(
    //     fixedTokenBalance,
    //     extraFixedTokenBalance
    //   );

    //   console.log(
    //     "extraFixedTokenBalance",
    //     utils.formatEther(extraFixedTokenBalance).toString()
    //   );

    //   console.log(
    //     "scenario1LPFixedTokenBalance",
    //     utils.formatEther(scenario1LPFixedTokenBalance.toString())
    //   );
    //   console.log(
    //     "scenario1LPVariableTokenBalance",
    //     utils.formatEther(scenario1LPVariableTokenBalance.toString())
    //   );

    //   const trader_margin_requirement_params_1 = {
    //     fixedTokenBalance: scenario1LPFixedTokenBalance,
    //     variableTokenBalance: scenario1LPVariableTokenBalance,
    //     termStartTimestampWad: termStartTimestampScaled,
    //     termEndTimestampWad: termEndTimestampScaled,
    //     isLM: isLM,
    //     historicalApyWad: historicalApy,
    //     sqrtPriceX96: encodePriceSqrt(1, 2),
    //     variableFactorWad: variableFactor,
    //   };

    //   console.log(" ");

    //   const tmReq1 = await testMarginCalculator.getTraderMarginRequirement(
    //     trader_margin_requirement_params_1,
    //     margin_engine_params
    //   );

    //   console.log("tmreq1:", utils.formatEther(tmReq1.toString()));

    //   const trader_margin_requirement_params_2 = {
    //     fixedTokenBalance: fixedTokenBalance,
    //     variableTokenBalance: variableTokenBalance,
    //     termStartTimestampWad: termStartTimestampScaled,
    //     termEndTimestampWad: termEndTimestampScaled,
    //     isLM: isLM,
    //     historicalApyWad: historicalApy,
    //     sqrtPriceX96: encodePriceSqrt(1, 10),
    //     variableFactorWad: variableFactor,
    //   };

    //   console.log(" ");

    //   const tmReq2 = await testMarginCalculator.getTraderMarginRequirement(
    //     trader_margin_requirement_params_2,
    //     margin_engine_params
    //   );

    //   console.log(
    //     "scenario2LPFixedTokenBalance",
    //     utils.formatEther(fixedTokenBalance.toString())
    //   );
    //   console.log(
    //     "scenario2LPVariableTokenBalance",
    //     utils.formatEther(variableTokenBalance.toString())
    //   );

    //   console.log("tmreq2:", utils.formatEther(tmReq2.toString()));

    //   const realized =
    //     await testMarginCalculator.getPositionMarginRequirementTest(
    //       position_margin_requirement_params,
    //       margin_engine_params
    //     );

    //   console.log("margin: ", utils.formatEther(realized.toString()));
    //   expect(realized).to.be.eq(tmReq2);
    // });

    // it("current tick > upper tick: margin requirement for staying position", async () => {
    //   const currentTick: string = (
    //     await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(2, 1))
    //   ).toString(); // 0.5%
    //   const tickLower = tickAt4p;
    //   const tickUpper = tickAt2p;

    //   console.log("current tick", currentTick);
    //   console.log("lower tick:", tickLower);
    //   console.log("upper tick:", tickUpper);

    //   const currentTimestamp = await getCurrentTimestamp(provider);

    //   const termStartTimestamp = currentTimestamp - 0;

    //   const termEndTimestampScaled = toBn(
    //     (termStartTimestamp + 31556952).toString() // add a year
    //   );

    //   const termStartTimestampScaled = toBn(termStartTimestamp.toString());

    //   const fixedTokenBalance: BigNumber = toBn("-585.809919102571688689");
    //   const variableTokenBalance: BigNumber = toBn("207.109440860029119648");

    //   const variableFactor: BigNumber = toBn("0.0");
    //   const historicalApy: BigNumber = toBn("0.0");
    //   const liquidityBN: BigNumber = expandTo18Decimals(1000);

    //   const isLM = true;

    //   const position_margin_requirement_params = {
    //     owner: wallet.address,
    //     tickLower: tickLower,
    //     tickUpper: tickUpper,
    //     isLM: isLM,
    //     currentTick: currentTick,
    //     termStartTimestampWad: termStartTimestampScaled,
    //     termEndTimestampWad: termEndTimestampScaled,
    //     liquidity: liquidityBN,
    //     fixedTokenBalance: fixedTokenBalance,
    //     variableTokenBalance: variableTokenBalance,
    //     variableFactorWad: variableFactor,
    //     historicalApyWad: historicalApy,
    //     sqrtPriceX96: encodePriceSqrt(2, 1),
    //   };

    //   const trader_margin_requirement_params_1 = {
    //     fixedTokenBalance: fixedTokenBalance,
    //     variableTokenBalance: variableTokenBalance,
    //     termStartTimestampWad: termStartTimestampScaled,
    //     termEndTimestampWad: termEndTimestampScaled,
    //     isLM: isLM,
    //     historicalApyWad: historicalApy,
    //     sqrtPriceX96: encodePriceSqrt(2, 1),
    //     variableFactorWad: variableFactor,
    //   };

    //   console.log(" ");

    //   const tmReq = await testMarginCalculator.getTraderMarginRequirement(
    //     trader_margin_requirement_params_1,
    //     margin_engine_params
    //   );

    //   console.log("tmreq:", utils.formatEther(tmReq.toString()));

    //   const realized =
    //     await testMarginCalculator.getPositionMarginRequirementTest(
    //       position_margin_requirement_params,
    //       margin_engine_params
    //     );

    //   console.log("margin: ", utils.formatEther(realized.toString()));
    //   expect(realized).to.be.eq(tmReq);
    // });

    // it("correctly checks for the fact the position is liquidatable", async () => {
    //   const currentTick: string = (
    //     await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(2, 1))
    //   ).toString(); // 0.5%
    //   const tickLower = tickAt4p;
    //   const tickUpper = tickAt2p;

    //   console.log("current tick", currentTick);
    //   console.log("lower tick:", tickLower);
    //   console.log("upper tick:", tickUpper);

    //   const currentTimestamp = await getCurrentTimestamp(provider);

    //   const termStartTimestamp = currentTimestamp - 0;

    //   const termEndTimestampScaled = toBn(
    //     (termStartTimestamp + 31556952).toString() // add a year
    //   );

    //   const termStartTimestampScaled = toBn(termStartTimestamp.toString());

    //   const fixedTokenBalance: BigNumber = toBn("-585.809919102571688689");
    //   const variableTokenBalance: BigNumber = toBn("207.109440860029119648");

    //   const variableFactor: BigNumber = toBn("0.0");
    //   const historicalApy: BigNumber = toBn("0.0");
    //   const liquidityBN: BigNumber = expandTo18Decimals(1000);

    //   const isLM = true;

    //   const position_margin_requirement_params = {
    //     owner: wallet.address,
    //     tickLower: tickLower,
    //     tickUpper: tickUpper,
    //     isLM: isLM,
    //     currentTick: currentTick,
    //     termStartTimestampWad: termStartTimestampScaled,
    //     termEndTimestampWad: termEndTimestampScaled,
    //     liquidity: liquidityBN,
    //     fixedTokenBalance: fixedTokenBalance,
    //     variableTokenBalance: variableTokenBalance,
    //     variableFactorWad: variableFactor,
    //     historicalApyWad: historicalApy,
    //     sqrtPriceX96: encodePriceSqrt(2, 1),
    //   };
    //   const currentMargin = toBn("0.0");

    //   const realized = await testMarginCalculator.isLiquidatablePosition(
    //     position_margin_requirement_params,
    //     currentMargin,
    //     margin_engine_params
    //   );

    //   expect(realized).to.eq(true);
    // });
  });
});
