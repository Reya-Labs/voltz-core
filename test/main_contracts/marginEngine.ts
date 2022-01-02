import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
// import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
import {
  getPositionKey,
  getMaxTick,
  getMinTick,
  TICK_SPACING,
  createVAMMMFunctions,
  SwapFunction,
  MintFunction,
  getMaxLiquidityPerTick,
  MaxUint128,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
  SwapToPriceFunction,
  mint,
  calculateFixedAndVariableDelta,
  calculateSettlementCashflow,
} from "../shared/utilities";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { RATE_ORACLE_ID, getGrowthInside } from "../shared/utilities";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
import { TestAMM } from "../../typechain/TestAMM";
import { ERC20Mock, TestVAMM, TestVAMMCallee } from "../../typechain";
import { sub, add } from "../shared/functions";
const { provider } = waffle;

const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("MarginEngine", () => {
  let wallet: Wallet, other: Wallet;
  // let marginEngineCalleeTest: TestMarginEngineCallee;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("#updateTraderMargin", () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
    });

    it("reverts if margin delta is zero", async () => {
      await expect(
        marginEngineTest.updateTraderMarginTest(0)
      ).to.be.revertedWith("InvalidMarginDelta");
    });
  });

  describe("#traders", () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
    });

    it("returns empty trader by default", async () => {
      const traderInfo = await marginEngineTest.traders(wallet.address);
      expect(traderInfo.margin).to.eq(0);
      expect(traderInfo.fixedTokenBalance).to.eq(0);
      expect(traderInfo.variableTokenBalance).to.eq(0);
      expect(traderInfo.isSettled).to.eq(false);
    });
  });

  describe("#positions", () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
    });

    it("returns empty position by default", async () => {
      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        0,
        1
      );
      expect(positionInfo._liquidity).to.eq(0);
      expect(positionInfo.margin).to.eq(0);
      expect(positionInfo.fixedTokenGrowthInsideLast).to.eq(0);
      expect(positionInfo.variableTokenGrowthInsideLast).to.eq(0);
      expect(positionInfo.fixedTokenBalance).to.eq(0);
      expect(positionInfo.variableTokenBalance).to.eq(0);
      expect(positionInfo.feeGrowthInsideLast).to.eq(0);
      // expect(positionInfo.isBurned).to.eq(false);
    });
  });

  describe("#checkTraderMargin", async () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
    });

    it("check position margin above requirement", async () => {
      const updatedMarginWouldBe = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");
      const ammAddress = await marginEngineTest.amm();

      await expect(
        marginEngineTest.checkTraderMarginAboveRequirementTest(
          updatedMarginWouldBe,
          fixedTokenBalance,
          variableTokenBalance,
          ammAddress
        )
      ).to.be.reverted;
    });

    it("check trader margin can be updated", async () => {
      const updatedMarginWouldBe = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");
      const ammAddress = await marginEngineTest.amm();
      const isTraderSettled = false;

      await expect(
        marginEngineTest.checkTraderMarginCanBeUpdated(
          updatedMarginWouldBe,
          fixedTokenBalance,
          variableTokenBalance,
          isTraderSettled,
          ammAddress
        )
      ).to.be.reverted;
    });
  });

  describe("#checkPositionMargin", async () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
    });

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
      const ammAddress = await marginEngineTest.amm();

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
          variableFactor,
          ammAddress
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
      const ammAddress = await marginEngineTest.amm();
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
          variableFactor,
          ammAddress
        )
      ).to.be.reverted;
    });
  });

  describe("#calculateLiquidatorRewardAndUpdatedMargin", async () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
    });

    it("calculateLiquidatorRewardAndUpdatedMargin is done correctly", async () => {
      const traderMargin = toBn("1.0");
      const liquidatorRewardAsProportionOfMargin = toBn("0.1");

      const [realizedLiquidatorReward, realizedUpdatedMargin] =
        await marginEngineTest.calculateLiquidatorRewardAndUpdatedMarginTest(
          traderMargin,
          liquidatorRewardAsProportionOfMargin
        );

      expect(realizedLiquidatorReward).to.eq(toBn("0.1"));
      expect(realizedUpdatedMargin).to.eq(toBn("0.9"));
    });
  });

  describe("#updateTraderMargin", async () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;
    let token: ERC20Mock;

    beforeEach("deploy fixture", async () => {
      ({ factory, token, marginEngineTest } = await loadFixture(metaFixture));
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(wallet.address, BigNumber.from(10).pow(27));
    });

    it("check trader margin correctly updated", async () => {
      await marginEngineTest.updateTraderMarginTest(toBn("10000000"));
      // retrieve the trader info object
      const traderInfo = await marginEngineTest.traders(wallet.address);
      const traderMargin = traderInfo[0];
      expect(traderMargin).to.eq(toBn("10000000"));
    });

    it("check token balance correctly updated", async () => {
      const oldTraderBalance = await token.balanceOf(wallet.address);
      const ammAddress = await marginEngineTest.amm();
      const oldAmmBalance = await token.balanceOf(ammAddress);
      const marginDelta = toBn("10000000");
      await marginEngineTest.updateTraderMarginTest(marginDelta);

      const newTraderBalanceExpected = sub(oldTraderBalance, marginDelta);
      const newAmmBalance = add(oldAmmBalance, marginDelta);

      const realizedTraderBalance = await token.balanceOf(wallet.address);
      const realizedAmmbalance = await token.balanceOf(ammAddress);

      expect(realizedTraderBalance).to.eq(newTraderBalanceExpected);
      expect(realizedAmmbalance).to.eq(newAmmBalance);
    });
  });

  describe("#updatePositionMargin", async () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;
    let token: ERC20Mock;
    let vammTest: TestVAMM;
    let vammCalleeTest: TestVAMMCallee;

    beforeEach("deploy fixture", async () => {

      ({ factory, token, vammTest, vammCalleeTest, marginEngineTest } = await loadFixture(metaFixture));
      await token.mint(wallet.address, BigNumber.from(10).pow(27))
      await token.approve(wallet.address, BigNumber.from(10).pow(27))

      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutside: toBn("1.0"),
        variableTokenGrowthOutside: toBn("-2.0"),
        feeGrowthOutside: toBn("0.1"),
        initialized: true
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutside: toBn("3.0"),
        variableTokenGrowthOutside: toBn("-4.0"),
        feeGrowthOutside: toBn("0.2"),
        initialized: true
      });

      await vammTest.setFixedTokenGrowthGlobal(toBn("5.0"));
      await vammTest.setVariableTokenGrowthGlobal(toBn("-7.0"));
  
    });

    it("correctly updates position margin (internal accounting)", async () => {
      
      await marginEngineTest.setPosition(wallet.address, -1, 1, 1, toBn("1000.0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), false);
      
      await marginEngineTest.updatePositionMargin({
        owner: wallet.address,
        tickLower: -1,
        tickUpper: 1,
        liquidityDelta: 10,
      }, toBn("1"));

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.margin).to.eq(toBn("1001"));
    
    })

    it("check token balance correctly updated", async () => {

      await marginEngineTest.setPosition(wallet.address, -1, 1, 1, toBn("1000.0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), false);
    
      const oldPositionBalance = await token.balanceOf(wallet.address);
      const ammAddress = await marginEngineTest.amm();
      const oldAmmBalance = await token.balanceOf(ammAddress);
      const marginDelta = toBn("1");
      
      await marginEngineTest.updatePositionMargin({
        owner: wallet.address,
        tickLower: -1,
        tickUpper: 1,
        liquidityDelta: 10,
      }, marginDelta);

      const newTraderBalanceExpected = sub(oldPositionBalance, marginDelta);
      const newAmmBalance = add(oldAmmBalance, marginDelta);
      
      const realizedPositionBalance = await token.balanceOf(wallet.address);
      const realizedAmmbalance = await token.balanceOf(ammAddress);

      expect(realizedPositionBalance).to.eq(newTraderBalanceExpected);
      expect(realizedAmmbalance).to.eq(newAmmBalance);
      
      
    })

  })

  describe("#updatePositionTokenBalances", async () => {

    let marginEngineTest: TestMarginEngine;
    let factory: Factory;
    let token: ERC20Mock;
    let vammTest: TestVAMM;
    let vammCalleeTest: TestVAMMCallee;
    

    beforeEach("deploy fixture", async () => {

      ({ factory, token, marginEngineTest, vammTest, vammCalleeTest } = await loadFixture(metaFixture));
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(wallet.address, BigNumber.from(10).pow(27));

      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutside: toBn("1.0"),
        variableTokenGrowthOutside: toBn("-2.0"),
        feeGrowthOutside: toBn("0.1"),
        initialized: true
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutside: toBn("3.0"),
        variableTokenGrowthOutside: toBn("-4.0"),
        feeGrowthOutside: toBn("0.2"),
        initialized: true
      });

      await vammTest.setFixedTokenGrowthGlobal(toBn("5.0"));
      await vammTest.setVariableTokenGrowthGlobal(toBn("-7.0"));
  
    });


    it("correctly updates position token balances (growth inside last)", async () => {

      await marginEngineTest.setPosition(wallet.address, -1, 1, 1, toBn("10.0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), false);

      await marginEngineTest.updatePositionTokenBalancesTest(wallet.address, -1, 1);
      
      const expectedFixedTokenGrowthInside = getGrowthInside(0, -1, 1, toBn("1.0"), toBn("3.0"), toBn("5.0"));
      const expectedVariableTokenGrowthInside = getGrowthInside(0, -1, 1, toBn("-2.0"), toBn("-4.0"), toBn("-7.0"));

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.fixedTokenGrowthInsideLast).to.eq(expectedFixedTokenGrowthInside);
      expect(positionInfo.variableTokenGrowthInsideLast).to.eq(expectedVariableTokenGrowthInside);

    })

    it("correctly updates position token balances (fixed and variable deltas)", async () => {

      await marginEngineTest.setPosition(wallet.address, -1, 1, 1, toBn("10.0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), false);

      await marginEngineTest.updatePositionTokenBalancesTest(wallet.address, -1, 1);
      
      const expectedFixedTokenGrowthInside = getGrowthInside(0, -1, 1, toBn("1.0"), toBn("3.0"), toBn("5.0"));
      const expectedVariableTokenGrowthInside = getGrowthInside(0, -1, 1, toBn("-2.0"), toBn("-4.0"), toBn("-7.0"));

      const [expectedFixedTokenDelta, expectedVariableTokenDelta] = calculateFixedAndVariableDelta(expectedFixedTokenGrowthInside, expectedVariableTokenGrowthInside, toBn("0"), toBn("0"), BigNumber.from(1));

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      expect(positionInfo.fixedTokenBalance).to.eq(expectedFixedTokenDelta);
      expect(positionInfo.variableTokenBalance).to.eq(expectedVariableTokenDelta);

    })


  })


  describe("#settleTrader", () => {
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;
    let ammTest: TestAMM;

    beforeEach("deploy fixture", async () => {
      ({ factory, marginEngineTest, ammTest } = await loadFixture(metaFixture));
    });

    it("reverts before maturity", async () => {
      await expect(marginEngineTest.settleTrader()).to.be.reverted;
    })

    it("correctly updates trader balances", async () => {
      
      await marginEngineTest.setTrader(wallet.address, toBn("100"), toBn("1000"), toBn("-2000"), false);

      const traderInfoOld = await marginEngineTest.traders(wallet.address);
      expect(traderInfoOld[1]).to.eq(toBn('1000'));
      expect(traderInfoOld[2]).to.eq(toBn('-2000'));

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settleTrader();
      const traderInfo = await marginEngineTest.traders(wallet.address);

      expect(traderInfo[1]).to.eq(toBn('0'));
      expect(traderInfo[2]).to.eq(toBn('0'));

    })


    it("correctly updates trader margin", async () => {
      await marginEngineTest.setTrader(wallet.address, toBn("100"), toBn("1000"), toBn("-2000"), false);
      const traderInfoOld = await marginEngineTest.traders(wallet.address);
      expect(traderInfoOld[0]).to.eq(toBn('100'));

      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settleTrader();
      const traderInfo = await marginEngineTest.traders(wallet.address);

      const termStartTimestamp = await ammTest.termStartTimestamp();
      const termEndTimestamp = await ammTest.termEndTimestamp();

      const currentBlockTimestamp = (await getCurrentTimestamp(provider)) + 1;

      // is just the fixed cashflow since the variable factor hasn't changed
      const expectedSettlementCashflow = calculateSettlementCashflow(toBn("1000"), toBn("-2000"), termStartTimestamp, termEndTimestamp, toBn("0"), toBn(currentBlockTimestamp.toString()));
      const expectedUpdatedMargin = add(expectedSettlementCashflow, toBn("100"));

      expect(traderInfo[0]).to.eq(expectedUpdatedMargin);
      expect(traderInfo.isSettled).to.eq(true);

    })

  
  });


  describe("settle position", async () => {

    let marginEngineTest: TestMarginEngine;
    let factory: Factory;
    let token: ERC20Mock;
    let vammTest: TestVAMM;
    let vammCalleeTest: TestVAMMCallee;
    let ammTest: TestAMM;
    

    beforeEach("deploy fixture", async () => {

      ({ factory, token, marginEngineTest, vammTest, vammCalleeTest, ammTest } = await loadFixture(metaFixture));
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(wallet.address, BigNumber.from(10).pow(27));

      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutside: toBn("1.0"),
        variableTokenGrowthOutside: toBn("-2.0"),
        feeGrowthOutside: toBn("0.1"),
        initialized: true
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutside: toBn("3.0"),
        variableTokenGrowthOutside: toBn("-4.0"),
        feeGrowthOutside: toBn("0.2"),
        initialized: true
      });

      await vammTest.setFixedTokenGrowthGlobal(toBn("5.0"));
      await vammTest.setVariableTokenGrowthGlobal(toBn("-7.0"));
  
    });

    it("correctly updates position margin", async () => {

      await marginEngineTest.setPosition(wallet.address, -1, 1, 0, toBn("1000.0"), toBn("0"), toBn("0"), toBn("1000"), toBn("-2000"), toBn("0"), false);
      
      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month
      await marginEngineTest.settlePosition({
        owner: wallet.address,
        tickLower: -1,
        tickUpper: 1,
        liquidityDelta: BigNumber.from(0) // does not matter for position settlements
      });

      const termStartTimestamp = await ammTest.termStartTimestamp();
      const termEndTimestamp = await ammTest.termEndTimestamp();

      const currentBlockTimestamp = (await getCurrentTimestamp(provider)) + 1;

      const settlementCashflow = calculateSettlementCashflow(toBn("1000"), toBn("-2000"), termStartTimestamp, termEndTimestamp, toBn("0"), toBn(currentBlockTimestamp.toString()));

      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        -1,
        1
      );

      const expectedPositionMargin = add(toBn("1000"), settlementCashflow);
      expect(positionInfo.margin).to.eq(expectedPositionMargin);
      expect(positionInfo.isSettled).to.eq(true);
      expect(positionInfo.fixedTokenBalance).to.eq(toBn("0"));
      expect(positionInfo.variableTokenBalance).to.eq(toBn("0"));

    })







  })



  

  
});
