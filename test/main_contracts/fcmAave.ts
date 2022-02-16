import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import {
  TICK_SPACING,
  getMaxLiquidityPerTick,
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
  printTraderWithYieldBearingTokensInfo,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import {
  ERC20Mock,
  // Factory,
  MockAaveLendingPool,
  MockAToken,
  TestAaveFCM,
  TestRateOracle,
  // TestRateOracle,
} from "../../typechain";
import { TickMath } from "../shared/tickMath";
import { advanceTime } from "../helpers/time";
import { add, div, mul, pow, sub } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;

// more vamm tests!

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  // let factory: Factory;
  let rateOracleTest: TestRateOracle;
  // let termStartTimestampBN: BigNumber;
  // let termEndTimestampBN: BigNumber;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;
  let mockAToken: MockAToken;
  let fcmTest: TestAaveFCM;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      // factory,
      token,
      rateOracleTest,
      aaveLendingPool,
      // termStartTimestampBN,
      // termEndTimestampBN,
      mockAToken,
      marginEngineTest,
      vammTest,
      fcmTest
    } = await loadFixture(metaFixture));

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
    await aaveLendingPool.setFactorPerSecondInRay(token.address, "1000000001000000000000000000");

    await marginEngineTest.setSecondsAgo(86400);

  });

  describe("#fcm", () => {
    beforeEach("initialize the pool at price of 1:1", async () => {
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token.connect(other).approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      const currentReserveNormalisedIncome = await aaveLendingPool.getReserveNormalizedIncome(token.address);

      // mint aTokens
      await mockAToken.mint(wallet.address, toBn("10000"), currentReserveNormalisedIncome);
      await mockAToken.approve(fcmTest.address, toBn("10000"));
    });

    it("scenario1", async () => {

      const otherStartingBalance = await token.balanceOf(other.address);
      
      await marginEngineTest.connect(other).updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        "1121850791579727450"
      );

      await vammTest.initializeVAMM(TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString());

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

      await vammTest.setFeeProtocol(0);
      await vammTest.setFee(toBn("0"));

      await vammTest.connect(other).mint(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );

      const traderStartingBalanceInATokens = await mockAToken.balanceOf(wallet.address);
      const traderStartingBalanceInUnderlyingTokens = await token.balanceOf(wallet.address);
      // can add since 1aToken=1Token
      const traderStartingOverallBalanceInUnderlyingTokens = add(traderStartingBalanceInATokens, traderStartingBalanceInUnderlyingTokens);

      console.log("traderStartingBalanceInATokens", utils.formatEther(traderStartingBalanceInATokens));
      console.log("traderStartingBalanceInUnderlyingTokens", utils.formatEther(traderStartingBalanceInUnderlyingTokens));
      console.log("traderStartingOverallBalanceInUnderlyingTokens", utils.formatEther(traderStartingOverallBalanceInUnderlyingTokens));
      
      // engage in a fixed taker swap via the fcm
      await fcmTest.initiateFullyCollateralisedFixedTakerSwap(toBn("10"), TickMath.getSqrtRatioAtTick(TICK_SPACING).toString());

      // do a full scenario with checks
      const traderInfo = await fcmTest.traders(wallet.address);
      printTraderWithYieldBearingTokensInfo(traderInfo);

      expect(traderInfo[2]).to.eq(toBn("-10")); // variable token balance the opposite of notional
        
      // time passes, trader's margin in yield bearing tokens should be the same as the atoken balance of the fcm
      await advanceTime(604800); // advance time by one week
      await rateOracleTest.writeOracleEntry();
      
      await marginEngineTest.getHistoricalApy();

      const historicalApyCached = await marginEngineTest.getCachedHistoricalApy();

      console.log("historicalApyCached", utils.formatEther(historicalApyCached));

      expect(await fcmTest.getAaveLendingPool(), "aave lending pool expect").to.eq(aaveLendingPool.address);
      expect(await fcmTest.marginEngine(), "margin engine address expect").to.eq(marginEngineTest.address);
      expect(await fcmTest.getUnderlyingYieldBearingToken(), "underlying yield bearing token expect").to.eq(mockAToken.address);
      expect(await fcmTest.getVAMMAddress(), "vamm address expect").to.eq(vammTest.address);
      
      // check a token balance of the fcm
      const aTokenBalanceOfFCM = await mockAToken.balanceOf(fcmTest.address);
      
      console.log("aTokenBalanceOfFCM", utils.formatEther(aTokenBalanceOfFCM));

      // check trader balance
      const aTokenBalanceOfTrader = await fcmTest.getTraderMarginInYieldBearingTokensTest(wallet.address);

      console.log("aTokenBalanceOfTrader", utils.formatEther(aTokenBalanceOfTrader));

      expect(aTokenBalanceOfFCM).to.eq(aTokenBalanceOfTrader);

      await fcmTest.settleTrader();

      const traderInfoPostSettlement = await fcmTest.traders(wallet.address);
      printTraderWithYieldBearingTokensInfo(traderInfoPostSettlement);
      
      expect(traderInfoPostSettlement[0]).to.eq(0);
      expect(traderInfoPostSettlement[1]).to.eq(0);
      expect(traderInfoPostSettlement[2]).to.eq(0);
      expect(traderInfoPostSettlement[3]).to.eq(true);

      const traderEndingBalanceInATokens = await mockAToken.balanceOf(wallet.address);
      const traderEndingBalanceInUnderlyingTokens = await token.balanceOf(wallet.address);
      const traderEndingOverallBalanceInUnderlyingTokens = add(traderEndingBalanceInATokens, traderEndingBalanceInUnderlyingTokens);
      
      console.log("traderEndingBalanceInATokens", utils.formatEther(traderEndingBalanceInATokens));
      console.log("traderEndingBalanceInUnderlyingTokens", utils.formatEther(traderEndingBalanceInUnderlyingTokens));
      console.log("traderEndingOverallBalanceInUnderlyingTokens", utils.formatEther(traderEndingOverallBalanceInUnderlyingTokens));
      
      const traderAbsoluteReturn = sub(traderEndingOverallBalanceInUnderlyingTokens, traderStartingOverallBalanceInUnderlyingTokens);
      const traderReturn = div(traderAbsoluteReturn, toBn("10")); // toBn("10") is the notional which the trader wanted to secure a fixed return on
      
      console.log("traderAbsoluteReturn", utils.formatEther(traderAbsoluteReturn));
      console.log("traderReturn", utils.formatEther(traderReturn));

      const traderAPY = sub(pow(add(toBn("1.0"), traderReturn), toBn("52.1775")), toBn("1.0"));
      
      console.log("traderAPY", utils.formatEther(traderAPY));

      expect(traderAPY).to.be.near(toBn("0.010116042450876211")); // around 1% fixed apy secured as expected

      // lp settles and collects their margin
      await marginEngineTest.settlePosition(-TICK_SPACING, TICK_SPACING, other.address);

      const positionInfo = await marginEngineTest.getPosition(other.address, -TICK_SPACING, TICK_SPACING);
      const finalPositionMargin = positionInfo[1];
      console.log("finalPositionMargin", utils.formatEther(finalPositionMargin));
      
      await marginEngineTest.connect(other).updatePositionMargin(
        other.address, -TICK_SPACING, TICK_SPACING, mul(finalPositionMargin, toBn("-1")) 
      );
      
      const positionInfoPostUpdateMargin = await marginEngineTest.getPosition(other.address, -TICK_SPACING, TICK_SPACING);
      const finalPositionMarginPostUpdateMargin = positionInfoPostUpdateMargin[1];
      
      expect(finalPositionMarginPostUpdateMargin).to.eq(0);

      // calculate the return of the LP

      const positionEndingBalanceInATokens = await mockAToken.balanceOf(other.address);
      const positionEndingBalanceInUnderlyingTokens = await token.balanceOf(other.address);
      const positionEndingOverallBalanceInUnderlyingTokens = add(positionEndingBalanceInATokens, positionEndingBalanceInUnderlyingTokens);
      
      const positionAbsoluteReturn = sub(positionEndingOverallBalanceInUnderlyingTokens, otherStartingBalance);
      const positionReturn = div(positionAbsoluteReturn, toBn("10")); // toBn("10") is the notional which the trader wanted to secure a fixed return on

      const positionAPY = sub(pow(add(toBn("1.0"), positionReturn), toBn("52.1775")), toBn("1.0"));
      
      console.log("positionAPY", utils.formatEther(positionAPY));

    });

  });
});
