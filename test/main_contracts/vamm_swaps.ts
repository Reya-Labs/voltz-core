import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import {
  TICK_SPACING,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
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
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { ERC20Mock, MockAaveLendingPool } from "../../typechain";
import { add, sub } from "../shared/functions";
import { TickMath } from "../shared/tickMath";

const createFixtureLoader = waffle.createFixtureLoader;

// more vamm tests!

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ token, aaveLendingPool, vammTest, marginEngineTest } = await loadFixture(
      metaFixture
    ));

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    const margin_engine_params = {
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

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);

    // set factor per second
    await aaveLendingPool.setFactorPerSecondInRay(
      token.address,
      "1000000001000000000000000000"
    );
  });

  describe("#swapAndBurn", () => {
    beforeEach("initialize the pool at price of 1:1", async () => {
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token
        .connect(other)
        .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );

      await marginEngineTest
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          toBn("100000")
        );
    });

    it("scenario1", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.setFee(toBn("0.003"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("1"),
        sqrtPriceLimitX96: BigNumber.from(
          TickMath.getSqrtRatioAtTick(TICK_SPACING * 2).toString()
        ),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      // check trader balances
      const traderInfo = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      const traderFixedTokenBalance = traderInfo.fixedTokenBalance;
      const traderVariableTokenBalance = traderInfo.variableTokenBalance;

      expect(traderInfo.variableTokenBalance).to.eq(toBn("-1"));

      await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        false
      );

      // check position token balances
      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionFixedTokenBalance = positionInfo.fixedTokenBalance;
      const positionVariableTokenBalance = positionInfo.variableTokenBalance;
      console.log("PFTB", positionFixedTokenBalance.toString());
      console.log("PVTB", positionVariableTokenBalance.toString());
      console.log("TFTB", traderFixedTokenBalance.toString());
      console.log("TVTB", traderVariableTokenBalance.toString());

      const sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance = add(
        positionFixedTokenBalance,
        traderFixedTokenBalance
      );

      console.log(
        "sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance",
        sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance.toString()
      );

      expect(positionVariableTokenBalance).to.be.near(toBn("1"));
      expect(traderVariableTokenBalance).to.eq(toBn("-1"));

      expect(
        sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance
      ).to.be.closeTo(toBn("0"), 10);

      console.log(
        sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance,
        "sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance"
      );
    });

    it("scenario 2: ", async () => {
      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.setFee(toBn("0.003"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("-1"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      // check trader balances
      const traderInfo = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      const traderFixedTokenBalance = traderInfo.fixedTokenBalance;
      const traderVariableTokenBalance = traderInfo.variableTokenBalance;

      expect(traderInfo.variableTokenBalance).to.eq(toBn("1"));

      await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        false
      );

      // check position token balances
      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionFixedTokenBalance = positionInfo.fixedTokenBalance;
      const positionVariableTokenBalance = positionInfo.variableTokenBalance;
      console.log("PFTB 2", positionFixedTokenBalance.toString());
      console.log("PVTB 2", positionVariableTokenBalance.toString());
      console.log("TFTB 2", traderFixedTokenBalance.toString());
      console.log("TVTB 2", traderVariableTokenBalance.toString());

      // note there is some discrepancy between the balances, they don't quite cancel each other
      // investigate the implications of this

      const sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance = add(
        positionFixedTokenBalance,
        traderFixedTokenBalance
      );

      console.log(
        "sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance 2",
        sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance.toString()
      );

      expect(positionVariableTokenBalance).to.be.closeTo(toBn("-1"), 10);

      expect(traderVariableTokenBalance).to.be.eq(toBn("1"));

      expect(
        sumOfTraderFixedTokenBalanceAndPositionFixedTokenBalance
      ).to.be.closeTo(toBn("0"), 10);
    });

    it("scenario 3: check fees (no protocol fees)", async () => {
      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.setFee(toBn("0.0005"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("-100"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const feesAccruedToLP = sub(positionInfo.margin, toBn("100000"));
      console.log("FATLP", feesAccruedToLP.toString());

      const expectedFees = toBn("0.000958877156265898"); // value from excel

      expect(feesAccruedToLP).to.be.near(expectedFees);
    });

    it("scenario 4: check fees (with protocol fees)", async () => {
      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.setFeeProtocol(3); // half of the fees go towards the protocol
      await vammTest.setFee(toBn("0.0005"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("-100"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const feesAccruedToLP = sub(positionInfo.margin, toBn("100000"));
      console.log("FATLP", feesAccruedToLP.toString());

      /// Expected fees = toBn("100") * 0.0005 * timeUntilMaturityInYears (approx the whole term which is a week)
      const expectedFees = BigNumber.from("639252494503665");

      expect(feesAccruedToLP).to.be.near(expectedFees);
    });

    it("scenario 5: check fees accrued = fees incurred", async () => {
      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.setFee(toBn("0.0005"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

      const traderInfoOld = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("-100"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      const traderInfo = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const feesAccruedToLP = sub(positionInfo.margin, toBn("100000"));
      console.log("FATLP", feesAccruedToLP.toString());

      const feesIncurredByTrader = sub(traderInfoOld.margin, traderInfo.margin);
      console.log("FIBT", feesIncurredByTrader.toString());

      /// Expected fees = toBn("100") * 0.0005 * timeUntilMaturityInYears (approx the whole term which is a week)
      const expectedFees = BigNumber.from("958877156265898");

      expect(feesAccruedToLP).to.be.near(expectedFees);
      expect(feesIncurredByTrader).to.be.near(expectedFees);
      expect(feesAccruedToLP).to.be.near(feesIncurredByTrader);
    });
  });
});
