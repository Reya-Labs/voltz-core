import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
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
  printTraderWithYieldBearingTokensInfo,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import {
  ERC20Mock,
  // Factory,
  MockAaveLendingPool,
  MockAToken,
  AaveFCM,
  TestRateOracle,
  // TestRateOracle,
} from "../../typechain";
import { TickMath } from "../shared/tickMath";
import { advanceTime } from "../helpers/time";
import { add, div, mul, pow, sub } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;

// todo: standardise and write a generic e2e with aave fcm!
// fix number to ray conversion (add num to ray function)
// understand the e2e scenario pipeline
// proceed to write more e2e scenarios with new conditions
// add new invariants to the scenarios --> use modular code

describe("FCM", () => {
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
  let fcmTest: AaveFCM;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  async function getTraderBalance(walletAddress: string) {
    const traderBalanceInATokens = await mockAToken.balanceOf(walletAddress);
    const traderBalanceInUnderlyingTokens = await token.balanceOf(
      walletAddress
    );
    // can add since 1aToken=1Token
    const traderOverallBalanceInUnderlyingTokens = add(
      traderBalanceInATokens,
      traderBalanceInUnderlyingTokens
    );

    console.log(
      "traderBalanceInATokens",
      utils.formatEther(traderBalanceInATokens)
    );
    console.log(
      "traderBalanceInUnderlyingTokens",
      utils.formatEther(traderBalanceInUnderlyingTokens)
    );
    console.log(
      "traderOverallBalanceInUnderlyingTokens",
      utils.formatEther(traderOverallBalanceInUnderlyingTokens)
    );

    return traderOverallBalanceInUnderlyingTokens;
  }

  async function printHistoricalApy() {
    await marginEngineTest.getHistoricalApy();

    const historicalApyCached = await marginEngineTest.getCachedHistoricalApy();

    console.log("historicalApyCached", utils.formatEther(historicalApyCached));
  }

  function getTraderApy(
    traderStartingOverallBalanceInUnderlyingTokens: BigNumber,
    traderEndingOverallBalanceInUnderlyingTokens: BigNumber
  ) {
    // todo: add more arguments to this function

    const traderAbsoluteReturn = sub(
      traderEndingOverallBalanceInUnderlyingTokens,
      traderStartingOverallBalanceInUnderlyingTokens
    );
    const traderReturn = div(traderAbsoluteReturn, toBn("100"));

    console.log(
      "traderAbsoluteReturn",
      utils.formatEther(traderAbsoluteReturn)
    );
    console.log("traderReturn", utils.formatEther(traderReturn));

    const traderAPY = sub(
      pow(add(toBn("1.0"), traderReturn), toBn("52.1775")),
      toBn("1.0")
    );

    console.log("traderAPY", utils.formatEther(traderAPY));

    return traderAPY;
  }

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
      fcmTest,
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

    await marginEngineTest.setLookbackWindowInSeconds(86400);
  });

  describe("#fcm", () => {
    beforeEach("initialize the pool at price of 1:1", async () => {
      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token
        .connect(other)
        .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      // mint underlyings to the mock aToken
      await token.mint(mockAToken.address, BigNumber.from(10).pow(27));
      const currentReserveNormalisedIncome =
        await aaveLendingPool.getReserveNormalizedIncome(token.address);

      // mint aTokens
      await mockAToken.mint(
        wallet.address,
        toBn("100"),
        currentReserveNormalisedIncome
      );
      await mockAToken.connect(wallet).approve(fcmTest.address, toBn("100"));
    });

    it("scenario1", async () => {
      expect(await fcmTest.aaveLendingPool(), "aave lending pool expect").to.eq(
        aaveLendingPool.address
      );
      expect(
        await fcmTest.marginEngine(),
        "margin engine address expect"
      ).to.eq(marginEngineTest.address);
      expect(
        await fcmTest.underlyingYieldBearingToken(),
        "underlying yield bearing token expect"
      ).to.eq(mockAToken.address);
      expect(await fcmTest.vamm(), "vamm address expect").to.eq(
        vammTest.address
      );

      const otherStartingBalance = await token.balanceOf(other.address);

      await marginEngineTest
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          "1121850791579727450"
        );

      await vammTest.initializeVAMM(
        TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString()
      );

      await vammTest
        .connect(other)
        .mint(other.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      const traderStartingOverallBalanceInUnderlyingTokens =
        await getTraderBalance(wallet.address);

      const allowance = await mockAToken
        .connect(wallet)
        .allowance(wallet.address, fcmTest.address);
      console.log("allowance", allowance.toString());

      // engage in a fixed taker swap via the fcm
      await fcmTest
        .connect(wallet)
        .initiateFullyCollateralisedFixedTakerSwap(
          toBn("100"),
          TickMath.getSqrtRatioAtTick(TICK_SPACING).toString()
        );

      // do a full scenario with checks
      const traderInfo = await fcmTest.traders(wallet.address);
      printTraderWithYieldBearingTokensInfo(traderInfo);

      expect(traderInfo.variableTokenBalance).to.eq(toBn("-100")); // variable token balance the opposite of notional

      // time passes, trader's margin in yield bearing tokens should be the same as the atoken balance of the fcm
      await advanceTime(604800); // advance time by one week
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        Math.floor(1.0015 * 10000 + 0.5).toString() + "0".repeat(23)
      );
      await rateOracleTest.writeOracleEntry();

      await printHistoricalApy();

      // check a token balance of the fcm
      const aTokenBalanceOfFCM = await mockAToken.balanceOf(fcmTest.address);

      console.log("aTokenBalanceOfFCM", utils.formatEther(aTokenBalanceOfFCM));

      // check trader balance
      const aTokenBalanceOfTrader = await fcmTest.getTraderMarginInATokens(
        wallet.address
      );

      console.log(
        "aTokenBalanceOfTrader",
        utils.formatEther(aTokenBalanceOfTrader)
      );

      expect(aTokenBalanceOfFCM).to.eq(aTokenBalanceOfTrader);

      await fcmTest.settleTrader();

      const traderInfoPostSettlement = await fcmTest.traders(wallet.address);
      printTraderWithYieldBearingTokensInfo(traderInfoPostSettlement);

      expect(traderInfoPostSettlement.fixedTokenBalance).to.eq(0);
      expect(traderInfoPostSettlement.variableTokenBalance).to.eq(0);
      expect(traderInfoPostSettlement.marginInScaledYieldBearingTokens).to.eq(
        0
      );
      expect(traderInfoPostSettlement.isSettled).to.eq(true);

      const traderEndingOverallBalanceInUnderlyingTokens =
        await getTraderBalance(wallet.address);

      const traderAPY = getTraderApy(
        traderStartingOverallBalanceInUnderlyingTokens,
        traderEndingOverallBalanceInUnderlyingTokens
      );

      expect(traderAPY).to.be.near(toBn("0.010116042450876211")); // around 1% fixed apy secured as expected

      // lp settles and collects their margin
      await marginEngineTest.settlePosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfo = await marginEngineTest.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      const finalPositionMargin = positionInfo.margin;
      console.log(
        "finalPositionMargin",
        utils.formatEther(finalPositionMargin)
      );

      await marginEngineTest
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          mul(finalPositionMargin, toBn("-1"))
        );

      const positionInfoPostUpdateMargin =
        await marginEngineTest.callStatic.getPosition(
          other.address,
          -TICK_SPACING,
          TICK_SPACING
        );
      const finalPositionMarginPostUpdateMargin =
        positionInfoPostUpdateMargin.margin;

      expect(finalPositionMarginPostUpdateMargin).to.be.near(toBn("0"));

      // calculate the return of the LP

      const positionEndingOverallBalanceInUnderlyingTokens =
        await getTraderBalance(other.address);
      const positionAPY = getTraderApy(
        otherStartingBalance,
        positionEndingOverallBalanceInUnderlyingTokens
      );

      console.log("positionAPY", utils.formatEther(positionAPY));
    });
  });
});
