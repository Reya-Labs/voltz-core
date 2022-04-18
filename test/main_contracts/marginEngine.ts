import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { metaFixture, tickMathFixture } from "../shared/fixtures";
import { toBn } from "evm-bn";
import {
  ERC20Mock,
  TestVAMM,
  TestMarginEngine,
  MockAaveLendingPool,
  TestRateOracle,
} from "../../typechain";
import {
  TICK_SPACING,
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
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
} from "../shared/utilities";
import {
  advanceTime,
  advanceTimeAndBlock,
  getCurrentTimestamp,
  setTimeNextBlock,
} from "../helpers/time";
import { consts } from "../helpers/constants";
import { sub } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;

describe("MarginEngine", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let aaveLendingPool: MockAaveLendingPool;
  let rateOracleTest: TestRateOracle;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);

    const { testTickMath } = await loadFixture(tickMathFixture);

    const min_tick = -69100;
    const max_tick = 69100;

    const min_price = await testTickMath.getSqrtRatioAtTick(-69100);
    const max_price = await testTickMath.getSqrtRatioAtTick(69100);

    console.log(" min_tick :", min_tick.toString());
    console.log("min_price :", min_price.toString());
    console.log(" max_tick :", max_tick.toString());
    console.log("max_price :", max_price.toString());
  });

  beforeEach("deploy fixture", async () => {
    ({ token, rateOracleTest, aaveLendingPool, marginEngineTest, vammTest } =
      await loadFixture(metaFixture));

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));
    await token
      .connect(other)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    await token.mint(wallet.address, BigNumber.from(10).pow(27));
    await token.approve(wallet.address, BigNumber.from(10).pow(27));

    // set vamm in the margin engine
    await marginEngineTest.setVAMM(vammTest.address);

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
    await marginEngineTest.setLiquidatorReward(toBn("0.1"));
  });

  describe("#updatePositionMargin", () => {
    it("reverts if margin delta is zero", async () => {
      // address _owner, int24 tickLower, int24 tickUpper, int256 marginDelta
      // await expect( marginEngineTest.updatePositionMargin( wallet.address, -TICK_SPACING, TICK_SPACING, 0 ) ).to.be.revertedWith("InvalidMarginDelta");
      // at the time of writing, waffle won't decipher custom errors thrown via proxies
      await expect(
        marginEngineTest.updatePositionMargin(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING,
          0
        )
      ).to.be.reverted;
    });
  });

  describe("#positions", () => {
    it("returns empty position by default", async () => {
      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        0,
        1
      );
      expect(positionInfo._liquidity).to.eq(0);
      expect(positionInfo.margin).to.eq(0);
      expect(positionInfo.fixedTokenGrowthInsideLastX128).to.eq(0);
      expect(positionInfo.variableTokenGrowthInsideLastX128).to.eq(0);
      expect(positionInfo.fixedTokenBalance).to.eq(0);
      expect(positionInfo.variableTokenBalance).to.eq(0);
      expect(positionInfo.feeGrowthInsideLastX128).to.eq(0);
    });
  });

  describe("#checkPositionMargin", async () => {
    beforeEach("initialize vamm", async () => {
      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));
    });

    it("check position margin above requirement reverted", async () => {
      const owner = wallet.address;
      const tickLower = -1;
      const tickUpper = 1;
      const counterfactualLiquidity = 10;

      // await expect( marginEngineTest.checkPositionMarginAboveRequirementTest( owner, tickLower, tickUpper, counterfactualLiquidity, 0, 0, 0 ) ).to.be.revertedWith("MarginLessThanMinimum");
      // at the time of writing, waffle won't decipher custom errors thrown via proxies
      await expect(
        marginEngineTest.checkPositionMarginAboveRequirementTest(
          owner,
          tickLower,
          tickUpper,
          counterfactualLiquidity,
          0,
          0,
          0
        )
      ).to.be.reverted;
    });

    it("check position margin can be updated reverted", async () => {
      const owner = wallet.address;
      const tickLower = -1;
      const tickUpper = 1;
      const counterfactualLiquidity = toBn("10");

      // await expect( marginEngineTest.checkPositionMarginCanBeUpdatedTest( owner, tickLower, tickUpper, counterfactualLiquidity, 0, 0, 0 ) ).to.be.revertedWith("MarginLessThanMinimum");
      // at the time of writing, waffle won't decipher custom errors thrown via proxies
      await expect(
        marginEngineTest.checkPositionMarginCanBeUpdatedTest(
          owner,
          tickLower,
          tickUpper,
          counterfactualLiquidity,
          0,
          0,
          0
        )
      ).to.be.reverted;
    });
  });

  describe("#checkTraderMargin", async () => {
    beforeEach("initialize vamm", async () => {
      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));
    });

    it("check position margin above requirement", async () => {
      const counterfactualMargin = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");

      // await expect( marginEngineTest.checkPositionMarginAboveRequirementTest( wallet.address, -TICK_SPACING, TICK_SPACING, 0, fixedTokenBalance, variableTokenBalance, counterfactualMargin ) ).to.be.revertedWith("MarginLessThanMinimum");
      // at the time of writing, waffle won't decipher custom errors thrown via proxies
      await expect(
        marginEngineTest.checkPositionMarginAboveRequirementTest(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING,
          0,
          fixedTokenBalance,
          variableTokenBalance,
          counterfactualMargin
        )
      ).to.be.reverted;
    });

    it("check trader margin can be updated", async () => {
      const counterfactualMargin = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");

      // await expect( marginEngineTest.checkPositionMarginCanBeUpdatedTest( wallet.address, -TICK_SPACING, TICK_SPACING, 0, fixedTokenBalance, variableTokenBalance, counterfactualMargin ) ).to.be.revertedWith("MarginLessThanMinimum");
      // at the time of writing, waffle won't decipher custom errors thrown via proxies
      await expect(
        marginEngineTest.checkPositionMarginCanBeUpdatedTest(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING,
          0,
          fixedTokenBalance,
          variableTokenBalance,
          counterfactualMargin
        )
      ).to.be.reverted;
    });
  });

  describe("#updatePositionMargin", async () => {
    it("check position margin correctly updated scenario 1", async () => {
      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1")
      );
      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      const positionMargin = positionInfo.margin;
      expect(positionMargin).to.eq(toBn("1"));
    });

    it("check trader margin correctly updated scenario 2", async () => {
      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("2")
      );
      let positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      let positionMargin = positionInfo.margin;
      expect(positionMargin).to.eq(toBn("2"));

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("-1")
      );
      positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      positionMargin = positionInfo.margin;
      expect(positionMargin).to.eq(toBn("1"));
    });

    it("check token balance correctly updated", async () => {
      const oldPositionBalance = await token.balanceOf(wallet.address);
      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );
      const marginDelta = toBn("1");
      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        marginDelta
      );

      const newPositionBalanceExpected = oldPositionBalance.sub(marginDelta);
      const newMarginEngineBalance = oldMarginEngineBalance.add(marginDelta);

      const realizedPositionBalance = await token.balanceOf(wallet.address);
      const realizedMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      expect(realizedPositionBalance).to.eq(newPositionBalanceExpected);
      expect(realizedMarginEngineBalance).to.eq(newMarginEngineBalance);
    });
  });

  describe("#updatePositionMargin", async () => {
    beforeEach("prepare the vamm", async () => {
      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      const FourQ128 = BigNumber.from(4).shl(128);
      const FourQ128Negative = FourQ128.mul(BigNumber.from(-1));

      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutsideX128: Q128,
        variableTokenGrowthOutsideX128: Q128Negative,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutsideX128: Q128Negative,
        variableTokenGrowthOutsideX128: Q128,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setFixedTokenGrowthGlobal(FourQ128);
      await vammTest.setVariableTokenGrowthGlobal(FourQ128Negative);
    });

    it("correctly updates position margin (internal accounting)", async () => {
      await marginEngineTest.setPosition(
        wallet.address,
        -1,
        1,
        1,
        toBn("1000"),
        0,
        0,
        0,
        0,
        0,
        false
      );

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -1,
        1,
        toBn("1")
      );
      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -1,
        1
      );
      expect(positionInfo.margin).to.be.near(toBn("1001"));
    });

    it("check token balance correctly updated", async () => {
      await marginEngineTest.setPosition(
        wallet.address,
        -1,
        1,
        1,
        1000,
        0,
        0,
        0,
        0,
        0,
        false
      );

      const oldPositionBalance = await token.balanceOf(wallet.address);
      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );
      const marginDelta = BigNumber.from(1);

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -1,
        1,
        marginDelta
      );

      const newTraderBalanceExpected = oldPositionBalance.sub(marginDelta);
      const newMarginEngineBalance = oldMarginEngineBalance.add(marginDelta);

      const realizedPositionBalance = await token.balanceOf(wallet.address);
      const realizedMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      expect(realizedPositionBalance).to.eq(newTraderBalanceExpected);
      expect(realizedMarginEngineBalance).to.eq(newMarginEngineBalance);
    });
  });

  describe("#unwindPosition", async () => {
    beforeEach("token approvals and updating position margin", async () => {
      await token.mint(wallet.address, BigNumber.from(100).pow(27));
      await token.approve(wallet.address, BigNumber.from(100).pow(27));

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,

        toBn("100000")
      );
    });

    it("liquidate and unwind LP", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000000")
      );

      await marginEngineTest.setPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("-1000000"),
        toBn("-10"),
        toBn("0"),
        false
      );

      await marginEngineTest.updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1")
      );

      {
        const positionInfo = await marginEngineTest.callStatic.getPosition(
          other.address,
          -TICK_SPACING,
          TICK_SPACING
        );
        expect(positionInfo.variableTokenBalance).to.not.be.equal(0);

        console.log(
          "variable token balance:",
          utils.formatEther(positionInfo.variableTokenBalance)
        );
      }

      await marginEngineTest.liquidatePosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      console.log(
        "variable token balance:",
        utils.formatEther(positionInfo.variableTokenBalance)
      );
      expect(positionInfo.variableTokenBalance).to.be.equal(toBn("0"));
    });

    it("not enough liquidity to unwind position", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000")
      );

      await marginEngineTest.setPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("-1000000"),
        toBn("-10"),
        toBn("0"),
        false
      ); // clearly liquidatable

      await marginEngineTest.updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1")
      );

      {
        const positionInfo = await marginEngineTest.callStatic.getPosition(
          other.address,
          -TICK_SPACING,
          TICK_SPACING
        );
        expect(positionInfo.variableTokenBalance).to.not.be.equal(0);
      }

      await marginEngineTest.unwindPositionTest(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      {
        const positionInfo = await marginEngineTest.callStatic.getPosition(
          other.address,
          -TICK_SPACING,
          TICK_SPACING
        );
        expect(positionInfo.variableTokenBalance).to.not.be.equal(0);
      }
    });

    it("unwinds Trader", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000000")
      );

      await marginEngineTest.setPosition(
        other.address,
        -1,
        1,
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("-1000000"),
        toBn("10"),
        toBn("0"),
        false
      );

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -1,
        1,
        toBn("1")
      );

      await marginEngineTest.unwindPositionTest(wallet.address, -1, 1);

      {
        const positionInfo = await marginEngineTest.callStatic.getPosition(
          other.address,
          -1,
          1
        );
        expect(positionInfo.variableTokenBalance).to.not.be.equal(0);
      }
    });
  });

  describe("#collectProtocol", () => {
    it("checkOwnerPrivilege", async () => {
      await expect(
        marginEngineTest
          .connect(other)
          .collectProtocol(other.address, toBn("1"))
      ).to.be.reverted;
    });

    it("checkCollectProtocol", async () => {
      await marginEngineTest.collectProtocol(other.address, toBn("0"));
    });
  });

  describe("#updatePositionTokenBalances", async () => {
    beforeEach("prepare the vamm", async () => {
      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      // const FourQ128 = BigNumber.from(4).shl(128);
      // const FourQ128Negative = FourQ128.mul(BigNumber.from(-1));

      await vammTest.setTickTest(-1, {
        liquidityGross: 1,
        liquidityNet: 1,
        fixedTokenGrowthOutsideX128: 0,
        variableTokenGrowthOutsideX128: 0,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 1,
        liquidityNet: -1,
        fixedTokenGrowthOutsideX128: 0,
        variableTokenGrowthOutsideX128: 0,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setFixedTokenGrowthGlobal(Q128);
      await vammTest.setVariableTokenGrowthGlobal(Q128Negative);
    });

    it("correctly updates position token balances (growth inside last)", async () => {
      await marginEngineTest.setPosition(
        wallet.address,
        -1,
        1,
        1,
        10,
        0,
        0,
        0,
        0,
        0,
        false
      );

      await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
        wallet.address,
        -1,
        1,
        false
      );

      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.fixedTokenGrowthInsideLastX128).to.eq(Q128);
      expect(positionInfo.variableTokenGrowthInsideLastX128).to.eq(
        Q128Negative
      );
    });

    it("correctly updates position token balances (fixed and variable deltas)", async () => {
      await marginEngineTest.setPosition(
        wallet.address,
        -1,
        1,
        toBn("1"),
        toBn("10.0"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        false
      );

      await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
        wallet.address,
        -1,
        1,
        false
      );

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.fixedTokenBalance).to.be.near(toBn("1"));
      expect(positionInfo.variableTokenBalance).to.be.near(toBn("-1"));
    });
  });

  describe("#settleTrader", () => {
    it("reverts before maturity", async () => {
      await expect(
        marginEngineTest.settlePosition(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING
        )
      ).to.be.reverted;
    });

    it("correctly updates position balances", async () => {
      await marginEngineTest.setPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        0,
        100,
        0,
        0,
        100,
        -200,
        0,
        false
      );

      const positionInfoOld = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      expect(positionInfoOld.variableTokenBalance).to.eq(-200);
      expect(positionInfoOld.fixedTokenBalance).to.eq(100);

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settlePosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      expect(positionInfo.variableTokenBalance).to.eq(0);
      expect(positionInfo.fixedTokenBalance).to.eq(0);
    });

    it("correctly updates position margin", async () => {
      await marginEngineTest.setPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        0,
        toBn("1"),
        0,
        0,
        toBn("1"),
        0,
        0,
        false
      );

      const positionInfoOld = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      expect(positionInfoOld.margin).to.eq(toBn("1"));

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settlePosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      const positionInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      expect(positionInfo.margin).to.eq(toBn("1.000191780821917808"));
      expect(positionInfo.isSettled).to.eq(true);
    });
  });

  describe("settle position", async () => {
    beforeEach("prepare the vamm", async () => {
      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      // const FourQ128 = BigNumber.from(4).shl(128);
      // const FourQ128Negative = FourQ128.mul(BigNumber.from(-1));

      await vammTest.setTickTest(-1, {
        liquidityGross: 1,
        liquidityNet: 1,
        fixedTokenGrowthOutsideX128: 0,
        variableTokenGrowthOutsideX128: 0,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 1,
        liquidityNet: -1,
        fixedTokenGrowthOutsideX128: 0,
        variableTokenGrowthOutsideX128: 0,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setFixedTokenGrowthGlobal(Q128);
      await vammTest.setVariableTokenGrowthGlobal(Q128Negative);

      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
    });

    it("scenario 1: position settlement", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      // address _owner, int24 tickLower, int24 tickUpper, int256 marginDelta
      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -1,
        1,
        toBn("100000")
      );

      // mint
      await vammTest.mint(wallet.address, -1, 1, toBn("1000"));

      await marginEngineTest
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          toBn("10000")
        );

      // swap

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("1"),
        sqrtPriceLimitX96: MAX_SQRT_RATIO.sub(1),
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

      await marginEngineTest.settlePosition(wallet.address, -1, 1);

      await marginEngineTest.settlePosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const traderInfoNew = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfoNew = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -1,
        1
      );

      // this should be close to zero!
      expect(traderInfoNew.margin.add(positionInfoNew.margin)).to.be.near(
        toBn("110000")
      );

      expect(positionInfoNew.isSettled).to.eq(true);
      expect(positionInfoNew.fixedTokenBalance).to.be.within(-10, 10);
      expect(positionInfoNew.variableTokenBalance).to.be.within(-10, 10);
    });
  });

  describe("liquidations", async () => {
    beforeEach("token approvals and updating position margin", async () => {
      await token.mint(wallet.address, BigNumber.from(100).pow(27));
      await token.approve(wallet.address, BigNumber.from(100).pow(27));

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );
    });

    it("scenario1: simple trader liquidation", async () => {
      const min_price = BigNumber.from(encodeSqrtRatioX96(1, 10).toString());
      await vammTest.initializeVAMM(min_price);

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000000")
      );

      await marginEngineTest.setPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("-1000000"),
        toBn("10"),
        toBn("0"),
        false
      ); // clearly liquidatable

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1")
      );

      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      const traderInfoOld = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      expect(traderInfoOld.variableTokenBalance).to.eq(toBn("10"));

      await marginEngineTest
        .connect(other)
        .liquidatePosition(wallet.address, -TICK_SPACING, TICK_SPACING);

      const traderInfo = await marginEngineTest.callStatic.getPosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const balanceOther = await token.balanceOf(other.address);
      // console.log("balanceOther", balanceOther.toString());

      const balanceMarginEngine = await token.balanceOf(
        marginEngineTest.address
      );

      const marginEngineBalanceDelta = sub(
        oldMarginEngineBalance,
        balanceMarginEngine
      );

      expect(balanceOther).to.eq(toBn("0.1"));
      expect(marginEngineBalanceDelta).to.eq(toBn("0.1"));

      expect(traderInfo.variableTokenBalance).to.eq("0");
      expect(traderInfo.margin).to.eq(toBn("0.9"));
    });

    it("scenario 2: simple position liquidation", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000000")
      );

      await marginEngineTest.setPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000"),
        toBn("0"),
        toBn("0"),
        toBn("0"),
        toBn("-1000000"),
        toBn("-10"),
        toBn("0"),
        false
      ); // clearly liquidatable

      await marginEngineTest.updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1")
      );

      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      const oldBalanceWallet = await token.balanceOf(wallet.address);
      console.log("oldBalanceOther", oldBalanceWallet.toString());

      const positionInfoOld = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      expect(positionInfoOld.variableTokenBalance).to.be.near(toBn("-10"));

      await marginEngineTest.liquidatePosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const balanceWallet = await token.balanceOf(wallet.address);
      console.log("balabalanceWalletnceOther", balanceWallet.toString());

      const balanceMarginEngine = await token.balanceOf(
        marginEngineTest.address
      );

      const marginEngineBalanceDelta = sub(
        oldMarginEngineBalance,
        balanceMarginEngine
      );
      const balanceWalletDelta = sub(balanceWallet, oldBalanceWallet);

      expect(balanceWalletDelta).to.be.near(toBn("0.2"));
      expect(marginEngineBalanceDelta).to.be.near(toBn("0.2"));

      expect(positionInfo.variableTokenBalance).to.be.near(toBn("0"));
      expect(positionInfo.margin).to.be.near(toBn("0.8"));
    });
  });

  describe("#getHistoricalApy[ReadOnly]", async () => {
    const oneInRay = toBn("1", consts.AAVE_RATE_DECIMALS);
    const apy = toBn("1.370752688", consts.AAVE_RATE_DECIMALS); // This is equivalent to compounding by 1.00000001 per second for 365 days = 31536000 seconds
    const secondsAgo = 86400;
    const cachePeriod = 21600;
    let startTime;
    // const apy = toBn("1.371039921"); // This is equivalent to compounding by 1.00000001 per second for 365.2425 days = 31556952 seconds

    beforeEach("deploy and initialize test oracle", async () => {
      await rateOracleTest.increaseObservationCardinalityNext(10);
      await aaveLendingPool.setReserveNormalizedIncome(token.address, oneInRay);
      await rateOracleTest.writeOracleEntry();

      startTime = await getCurrentTimestamp();

      await marginEngineTest.setLookbackWindowInSeconds(secondsAgo); // one day
      await marginEngineTest.setCacheMaxAgeInSeconds(cachePeriod); // six hours
      await aaveLendingPool.setReserveNormalizedIncome(token.address, apy);
      await setTimeNextBlock(startTime + 31536000); // One year after first reading
      await rateOracleTest.writeOracleEntry();
    });

    it("correctly computes historical apy without cache", async () => {
      const realizedHistoricalApy1 =
        await marginEngineTest.getHistoricalApyReadOnly();
      expect(realizedHistoricalApy1, "matches input APY").to.be.closeTo(
        apy.sub(oneInRay).div(1e9), // convert rate in ray to APY in wad
        100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
      );
      const realizedHistoricalApy2 =
        await marginEngineTest.callStatic.getHistoricalApy();
      expect(
        realizedHistoricalApy1,
        "view and non-view give same answer"
      ).to.eq(realizedHistoricalApy2);
    });

    it("correctly caches historical apy", async () => {
      // Fist write the cache. Note that the rate won't exactly match the APY because another block has elapsed but we have not updated reserveNormalizedIncome. This is OK because we are only testing caching.
      await marginEngineTest.getHistoricalApy();
      const realizedHistoricalApy1a =
        await marginEngineTest.getHistoricalApyReadOnly();
      const realizedHistoricalApy1b =
        await marginEngineTest.callStatic.getHistoricalApy();
      expect(
        realizedHistoricalApy1a,
        "view and non-view give same answer"
      ).to.eq(realizedHistoricalApy1b);

      // Still within cache window so expect results unchanged
      await advanceTime(cachePeriod - 100);
      const realizedHistoricalApy2a =
        await marginEngineTest.getHistoricalApyReadOnly();
      const realizedHistoricalApy2b =
        await marginEngineTest.callStatic.getHistoricalApy();
      expect(realizedHistoricalApy2a, "cached value returned (2)").to.eq(
        realizedHistoricalApy1a
      );
      expect(
        realizedHistoricalApy2a,
        "view and non-view give same answer (2)"
      ).to.eq(realizedHistoricalApy2b);

      // Now moving outside the cache window so expect lower APY to be returned (because reserveNormalizedIncome has not been updated so interest has effectively stopped accruing throughout the cache period)
      await advanceTime(101);
      const realizedHistoricalApy3a =
        await marginEngineTest.getHistoricalApyReadOnly();
      const realizedHistoricalApy3b =
        await marginEngineTest.callStatic.getHistoricalApy();
      expect(
        realizedHistoricalApy3a,
        "value now is lower than what was cached before"
      ).to.be.lt(realizedHistoricalApy2a);
      expect(
        realizedHistoricalApy3a,
        "view and non-view give same answer (3)"
      ).to.eq(realizedHistoricalApy3b);
    });
  });
});
