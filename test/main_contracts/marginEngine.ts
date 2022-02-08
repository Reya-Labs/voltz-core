import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import {
  advanceTime,
  advanceTimeAndBlock,
  getCurrentTimestamp,
  setTimeNextBlock,
} from "../helpers/time";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import { sub, add } from "../shared/functions";
import {
  ERC20Mock,
  Factory,
  TestRateOracle,
  TestVAMM,
  TestMarginEngine,
  MockAaveLendingPool,
} from "../../typechain";
import {
  encodeSqrtRatioX96,
  getMaxLiquidityPerTick,
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
} from "../shared/utilities";

const createFixtureLoader = waffle.createFixtureLoader;

describe("MarginEngine", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let factory: Factory;
  let aaveLendingPool: MockAaveLendingPool;
  let rateOracleTest: TestRateOracle;
  let termStartTimestampBN: BigNumber;
  let termEndTimestampBN: BigNumber;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      factory,
      token,
      rateOracleTest,
      termStartTimestampBN,
      termEndTimestampBN,
      aaveLendingPool,
    } = await loadFixture(metaFixture));

    // deploy a margin engine & vamm
    await factory.deployIrsInstance(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const marginEngineAddress = await factory.getMarginEngineAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine"
    );
    marginEngineTest = marginEngineTestFactory.attach(
      marginEngineAddress
    ) as TestMarginEngine;
    const vammAddress = await factory.getVAMMAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    vammTest = vammTestFactory.attach(vammAddress) as TestVAMM;

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));
    await token
      .connect(other)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    await token.mint(wallet.address, BigNumber.from(10).pow(27));
    await token.approve(wallet.address, BigNumber.from(10).pow(27));

    // set vamm in the margin engine
    await marginEngineTest.setVAMMAddress(vammTest.address);

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
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);
    await marginEngineTest.setLiquidatorReward(toBn("0.1"));
  });

  describe("#updateTraderMargin", () => {
    it("reverts if margin delta is zero", async () => {
      await expect(
        marginEngineTest.updateTraderMargin(wallet.address, 0)
      ).to.be.revertedWith("InvalidMarginDelta");
    });
  });

  describe("#traders", () => {
    it("returns empty trader by default", async () => {
      const traderInfo = await marginEngineTest.traders(wallet.address);
      expect(traderInfo.margin).to.eq(0);
      expect(traderInfo.fixedTokenBalance).to.eq(0);
      expect(traderInfo.variableTokenBalance).to.eq(0);
      expect(traderInfo.isSettled).to.eq(false);
    });
  });

  describe("#positions", () => {
    it("returns empty position by default", async () => {
      const positionInfo = await marginEngineTest.getPosition(
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
    it("check position margin above requirement reverted", async () => {
      const owner = wallet.address;
      const tickLower = -1;
      const tickUpper = 1;
      const liquidityDelta = 10;
      const updatedMarginWouldBe = toBn("0");
      const positionLiquidity = 10;
      const positionFixedTokenBalance = toBn("0");
      const positionVariableTokenBalance = toBn("0");
      const variableFactor = toBn("0.1");

      await expect(
        marginEngineTest.checkPositionMarginAboveRequirementTest(
          owner,
          tickLower,
          tickUpper,
          liquidityDelta,
          updatedMarginWouldBe,
          positionLiquidity,
          positionFixedTokenBalance,
          positionVariableTokenBalance,
          variableFactor
        )
      ).to.be.reverted;
    });

    it("check position margin can be updated reverted", async () => {
      const owner = wallet.address;
      const tickLower = -1;
      const tickUpper = 1;
      const liquidityDelta = 10;
      const updatedMarginWouldBe = toBn("0");
      const positionLiquidity = 10;
      const positionFixedTokenBalance = toBn("0");
      const positionVariableTokenBalance = toBn("0");
      const variableFactor = toBn("0.1");
      const isPositionBurned = false;
      const isPositionSettled = false;

      await expect(
        marginEngineTest.checkPositionMarginCanBeUpdatedTest(
          owner,
          tickLower,
          tickUpper,
          liquidityDelta,
          updatedMarginWouldBe,
          isPositionBurned,
          isPositionSettled,
          positionLiquidity,
          positionFixedTokenBalance,
          positionVariableTokenBalance,
          variableFactor
        )
      ).to.be.reverted;
    });
  });

  describe("#checkTraderMargin", async () => {
    it("check position margin above requirement", async () => {
      const updatedMarginWouldBe = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");

      await expect(
        marginEngineTest.checkTraderMarginAboveRequirementTest(
          updatedMarginWouldBe,
          fixedTokenBalance,
          variableTokenBalance
        )
      ).to.be.reverted;
    });

    it("check trader margin can be updated", async () => {
      const updatedMarginWouldBe = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");
      const isTraderSettled = false;

      await expect(
        marginEngineTest.checkTraderMarginCanBeUpdatedTest(
          updatedMarginWouldBe,
          fixedTokenBalance,
          variableTokenBalance,
          isTraderSettled
        )
      ).to.be.reverted;
    });
  });

  describe("#updateTraderMargin", async () => {
    it("check trader margin correctly updated scenario 1", async () => {
      // console.log("CR1");
      await marginEngineTest.updateTraderMargin(wallet.address, 1);
      // console.log("CR2");
      // retrieve the trader info object
      const traderInfo = await marginEngineTest.traders(wallet.address);
      // console.log("CR3");
      const traderMargin = traderInfo[0];
      expect(traderMargin).to.eq(1);
    });

    it("check trader margin correctly updated scenario 2", async () => {
      // console.log("CR1");
      await marginEngineTest.updateTraderMargin(wallet.address, 2);
      // console.log("CR2");
      // retrieve the trader info object
      let traderInfo = await marginEngineTest.traders(wallet.address);
      // console.log("CR3");
      let traderMargin = traderInfo[0];
      expect(traderMargin).to.eq(2);
      await marginEngineTest.updateTraderMargin(wallet.address, -1);
      // console.log("CR2");
      // retrieve the trader info object
      traderInfo = await marginEngineTest.traders(wallet.address);
      // console.log("CR3");
      traderMargin = traderInfo[0];
      expect(traderMargin).to.eq(1);
    });

    it("check token balance correctly updated", async () => {
      const oldTraderBalance = await token.balanceOf(wallet.address);
      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );
      const marginDelta = BigNumber.from(1);
      await marginEngineTest.updateTraderMargin(wallet.address, marginDelta);

      const newTraderBalanceExpected = sub(oldTraderBalance, marginDelta);
      const newMarginEngineBalance = add(oldMarginEngineBalance, marginDelta);

      const realizedTraderBalance = await token.balanceOf(wallet.address);
      const realizedMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      expect(realizedTraderBalance).to.eq(newTraderBalanceExpected);
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
        1000,
        0,
        0,
        0,
        0,
        0,
        false
      );

      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -1,
          tickUpper: 1,
          liquidityDelta: 10,
        },
        1
      );

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.margin).to.eq(1001);
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
        {
          owner: wallet.address,
          tickLower: -1,
          tickUpper: 1,
          liquidityDelta: 10,
        },
        marginDelta
      );

      const newTraderBalanceExpected = sub(oldPositionBalance, marginDelta);
      const newMarginEngineBalance = add(oldMarginEngineBalance, marginDelta);

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
        {
          owner: wallet.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("100000")
      );
    });

    it("unwinds position", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

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
        {
          owner: other.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("1")
      );

      {
        const positionInfo = await marginEngineTest.getPosition(
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
        const positionInfo = await marginEngineTest.getPosition(
          other.address,
          -TICK_SPACING,
          TICK_SPACING
        );
        expect(positionInfo.variableTokenBalance).to.be.equal(0);
      }
    });

    it("not enough liquidity to unwind position", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      await vammTest.initializeVAMM(MAX_SQRT_RATIO.sub(1));

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

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
        {
          owner: other.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("1")
      );

      {
        const positionInfo = await marginEngineTest.getPosition(
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
        const positionInfo = await marginEngineTest.getPosition(
          other.address,
          -TICK_SPACING,
          TICK_SPACING
        );
        expect(positionInfo.variableTokenBalance).to.not.be.equal(0);
      }
    });

    it("unwinds Trader", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000000")
      );

      await marginEngineTest.setTrader(
        wallet.address,
        toBn("0"),
        toBn("-1000000"),
        toBn("10"),
        false
      );

      await marginEngineTest.updateTraderMargin(wallet.address, toBn("1"));

      await marginEngineTest.unwindTraderTest(wallet.address, toBn("10"));

      const traderInfo = marginEngineTest.traders(wallet.address);
      expect((await traderInfo).variableTokenBalance).to.eq(toBn("0"));
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
        1
      );

      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      const positionInfo = await marginEngineTest.getPosition(
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
        1,
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
        1
      );

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.fixedTokenBalance).to.eq(1);
      expect(positionInfo.variableTokenBalance).to.eq(-1);
    });
  });

  describe("#settleTrader", () => {
    it("reverts before maturity", async () => {
      await expect(marginEngineTest.settleTrader(wallet.address)).to.be
        .reverted;
    });

    it("correctly updates trader balances", async () => {
      await marginEngineTest.setTrader(wallet.address, 100, 100, -200, false);

      const traderInfoOld = await marginEngineTest.traders(wallet.address);
      expect(traderInfoOld[1]).to.eq(100);
      expect(traderInfoOld[2]).to.eq(-200);

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settleTrader(wallet.address);

      const traderInfo = await marginEngineTest.traders(wallet.address);

      expect(traderInfo[1]).to.eq(0);
      expect(traderInfo[2]).to.eq(0);
    });

    it("correctly updates trader margin", async () => {
      await marginEngineTest.setTrader(
        wallet.address,
        toBn("1"),
        toBn("1"),
        0,
        false
      );
      const traderInfoOld = await marginEngineTest.traders(wallet.address);
      expect(traderInfoOld[0]).to.eq(toBn("1"));

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settleTrader(wallet.address);
      const traderInfo = await marginEngineTest.traders(wallet.address);

      expect(traderInfo[0]).to.eq(toBn("1.000191780821917808"));
      expect(traderInfo.isSettled).to.eq(true);
    });
  });

  // fails for now
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
      await vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(100));
      await vammTest.setTickSpacing(TICK_SPACING);
    });

    it.skip("scenario 1: position settlement", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.approve(other.address, BigNumber.from(10).pow(27));

      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -1,
          tickUpper: 1,
          liquidityDelta: 0,
        },
        toBn("100000")
      );

      // mint
      await vammTest.mint(wallet.address, -1, 1, toBn("1000"));

      await marginEngineTest
        .connect(other)
        .updateTraderMargin(other.address, toBn("10000"));

      // swap

      await vammTest.connect(other).swap({
        recipient: other.address,
        isFT: true,
        amountSpecified: toBn("1"),
        sqrtPriceLimitX96: MAX_SQRT_RATIO.sub(1),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

      const traderInfo = await marginEngineTest.traders(other.address);
      // console.log("TFTB", traderInfo.fixedTokenBalance.toString());
      // console.log("TVTB", traderInfo.variableTokenBalance.toString());

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );
      // console.log("PFTB", positionInfo.fixedTokenBalance.toString());
      // console.log("PVTB", positionInfo.variableTokenBalance.toString());

      await marginEngineTest.settlePosition({
        owner: wallet.address,
        tickLower: -1,
        tickUpper: 1,
        liquidityDelta: 0,
      });

      await marginEngineTest.settleTrader(other.address);

      const traderInfoNew = await marginEngineTest.traders(other.address);

      const positionInfoNew = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      const traderMarginDelta = sub(traderInfoNew.margin, traderInfo.margin);
      const positionMarginDelta = sub(
        positionInfoNew.margin,
        positionInfo.margin
      );

      // console.log("traderMarginDelta", traderMarginDelta.toString());
      // console.log("positionMarginDelta", positionMarginDelta.toString());

      const sumOfTraderMarginDeltaAndPositionMarginDelta = add(
        traderMarginDelta,
        positionMarginDelta
      );

      // console.log(
      //   "sumOfTraderMarginDeltaAndPositionMarginDelta",
      //   sumOfTraderMarginDeltaAndPositionMarginDelta.toString()
      // );

      // small discrepancy in the delta below
      expect(sumOfTraderMarginDeltaAndPositionMarginDelta).to.eq(
        toBn("-0.191589240287870206")
      );
      expect(positionInfoNew.isSettled).to.eq(true);
      expect(positionInfoNew.fixedTokenBalance).to.eq(toBn("0"));
      expect(positionInfoNew.variableTokenBalance).to.eq(toBn("0"));
    });
  });

  describe("liquidations", async () => {
    beforeEach("token approvals and updating position margin", async () => {
      await token.mint(wallet.address, BigNumber.from(100).pow(27));
      await token.approve(wallet.address, BigNumber.from(100).pow(27));

      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("100000")
      );
    });

    it("scenario1: simple trader liquidation", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000000")
      );

      await marginEngineTest.setTrader(
        wallet.address,
        toBn("0"),
        toBn("-1000000"),
        toBn("10"),
        false
      ); // clearly liquidatable

      await marginEngineTest.updateTraderMargin(wallet.address, toBn("1"));

      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      const traderInfoOld = await marginEngineTest.traders(wallet.address);
      expect(traderInfoOld.variableTokenBalance).to.eq(toBn("10"));

      await marginEngineTest.connect(other).liquidateTrader(wallet.address);

      const traderInfo = await marginEngineTest.traders(wallet.address);

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

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

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
        {
          owner: other.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("1")
      );

      const oldMarginEngineBalance = await token.balanceOf(
        marginEngineTest.address
      );

      const oldBalanceWallet = await token.balanceOf(wallet.address);
      console.log("oldBalanceOther", oldBalanceWallet.toString());

      const positionInfoOld = await marginEngineTest.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      expect(positionInfoOld.variableTokenBalance).to.eq(toBn("-10"));

      // await marginEngineTest.connect(other).liquidateTrader(wallet.address);
      await marginEngineTest.liquidatePosition({
        owner: other.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        liquidityDelta: 0,
      });

      const positionInfo = await marginEngineTest.getPosition(
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

      expect(balanceWalletDelta).to.eq(toBn("0.1"));
      expect(marginEngineBalanceDelta).to.eq(toBn("0.1"));

      expect(positionInfo.variableTokenBalance).to.eq("0");
      expect(positionInfo.margin).to.eq(toBn("0.9"));
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
      await rateOracleTest.increaseObservarionCardinalityNext(10);
      await aaveLendingPool.setReserveNormalizedIncome(token.address, oneInRay);
      await rateOracleTest.writeOracleEntry();

      startTime = await getCurrentTimestamp();

      await marginEngineTest.setSecondsAgo(secondsAgo); // one day
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
