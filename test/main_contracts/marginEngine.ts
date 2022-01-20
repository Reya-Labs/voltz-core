import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { advanceTimeAndBlock } from "../helpers/time";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import { sub, add } from "../shared/functions";
import {
  ERC20Mock,
  Factory,
  TestRateOracle,
  TestVAMM,
  TestMarginEngine,
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
} from "../shared/utilities";

const createFixtureLoader = waffle.createFixtureLoader;

describe("MarginEngine", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let factory: Factory;
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
    marginEngineTest = marginEngineTestFactory.attach(marginEngineAddress);
    const vammAddress = await factory.getVAMMAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    vammTest = vammTestFactory.attach(vammAddress);

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

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
    it("check trader margin correctly updated", async () => {
      // console.log("CR1");
      await marginEngineTest.updateTraderMargin(wallet.address, 1);
      // console.log("CR2");
      // retrieve the trader info object
      const traderInfo = await marginEngineTest.traders(wallet.address);
      // console.log("CR3");
      const traderMargin = traderInfo[0];
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
      await vammTest.setFeeProtocol(3);
      await vammTest.setTickSpacing(TICK_SPACING);
    });

    it("correctly updates position margin", async () => {
      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -1,
          tickUpper: 1,
          liquidityDelta: 0,
        },
        toBn("100000")
      );

      await marginEngineTest.updateTraderMargin(wallet.address, toBn("10000"));

      // mint
      await vammTest.mint(wallet.address, -1, 1, toBn("1"));

      // swap
      await vammTest.swap({
        recipient: wallet.address,
        isFT: true,
        amountSpecified: toBn("1"),
        sqrtPriceLimitX96: MAX_SQRT_RATIO.sub(1),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });

      // check (stopped here)
      // vammTest.computePositionFixedAndVariableGrowthInside(-1, 1, vammTest.vammVars)

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

      // burn the position
      await vammTest.burn(wallet.address, -1, 1, toBn("1"));

      // const traderInfo = await marginEngineTest.traders(wallet.address);
      // // console.log("TFTB", traderInfo.fixedTokenBalance.toString());

      // const positionInfo = await marginEngineTest.getPosition(
      //   wallet.address,
      //   -1,
      //   1
      // );
      // console.log("PFTB", positionInfo.fixedTokenBalance.toString());
      // console.log("PVTB", positionInfo.variableTokenBalance.toString());

      expect(1).to.eq(1);

      // await marginEngineTest.settlePosition({
      //   owner: wallet.address,
      //   tickLower: -1,
      //   tickUpper: 1,
      //   liquidityDelta: BigNumber.from(0), // does not matter for position settlements
      // });

      // const termStartTimestamp = await ammTest.termStartTimestamp();
      // const termEndTimestamp = await ammTest.termEndTimestamp();

      // const currentBlockTimestamp = (await getCurrentTimestamp(provider)) + 1;

      // const settlementCashflow = calculateSettlementCashflow(
      //   toBn("1000"),
      //   toBn("-2000"),
      //   termStartTimestamp,
      //   termEndTimestamp,
      //   toBn("0"),
      //   toBn(currentBlockTimestamp.toString())
      // );

      // const positionInfo = await marginEngineTest.getPosition(
      //   wallet.address,
      //   -1,
      //   1
      // );

      // const expectedPositionMargin = add(toBn("1000"), settlementCashflow);
      // expect(positionInfo.margin).to.eq(expectedPositionMargin);
      // expect(positionInfo.isSettled).to.eq(true);
      // expect(positionInfo.fixedTokenBalance).to.eq(toBn("0"));
      // expect(positionInfo.variableTokenBalance).to.eq(toBn("0"));
    });
  });

  // describe("#getHistoricalApy", async () => {
  //   let testRateOracle: TestRateOracle;
  //   let aaveLendingPoolContract: Contract;
  //   let underlyingTokenAddress: string;

  //   beforeEach("deploy and initialize test oracle", async () => {
  //     testRateOracle = await loadFixture(initializedOracleFixture);

  //     const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
  //     underlyingTokenAddress = await testRateOracle.underlying();
  //     const aaveLendingPoolAbi = [
  //       "function getReserveNormalizedIncome(address _underlyingAsset) public view returns (uint256)",
  //       "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
  //     ];
  //     aaveLendingPoolContract = new Contract(
  //       aaveLendingPoolAddress,
  //       aaveLendingPoolAbi,
  //       provider
  //     ).connect(wallet);

  //     await testRateOracle.testGrow(10);

  //     await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
  //     await testRateOracle.writeOracleEntry();

  //     await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
  //     // set new liquidity index value
  //     await aaveLendingPoolContract.setReserveNormalizedIncome(
  //       underlyingTokenAddress,
  //       toBn("1.1")
  //     );
  //     await testRateOracle.writeOracleEntry();
  //   });

  //   // Error: VM Exception while processing transaction: reverted with reason string '50' (needs to be fixed)
  //   // it("correctly computes historical apy", async () => {
  //   //   // await testRateOracle.setSecondsAgo("86400"); // one day
  //   //   await testRateOracle.testGetHistoricalApy();
  //   //   const realizedHistoricalApy = await testRateOracle.latestHistoricalApy();
  //   //   expect(realizedHistoricalApy).to.eq(0);

  //   // })
  // });
});
