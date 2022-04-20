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
  MockCToken,
  CompoundFCM,
  TestRateOracle,
} from "../../typechain";
import { TickMath } from "../shared/tickMath";
import { advanceTime } from "../helpers/time";
import { add, div, mul, pow, sub } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;

// todo: standardise and write a generic e2e with Compound fcm!
// fix number to ray conversion (add num to ray function)
// understand the e2e scenario pipeline
// proceed to write more e2e scenarios with new conditions
// add new invariants to the scenarios --> use modular code

describe("FCM Compound", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let rateOracleTest: TestRateOracle;
  let vammCompound: TestVAMM;
  let marginEngineCompound: TestMarginEngine;
  let mockCToken: MockCToken;
  let fcmCompound: CompoundFCM;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  async function getTraderBalance(walletAddress: string) {
    const traderBalanceInCTokens = await mockCToken.balanceOf(walletAddress);
    const traderBalanceInUnderlyingTokens = await token.balanceOf(
      walletAddress
    );
    // can add since 1aToken=1Token TODO: MODIFY FOR COMPOUND
    const traderOverallBalanceInUnderlyingTokens = add(
      traderBalanceInCTokens,
      traderBalanceInUnderlyingTokens
    );

    console.log(
      "traderBalanceInCTokens",
      utils.formatEther(traderBalanceInCTokens)
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
    await marginEngineCompound.getHistoricalApy();

    const historicalApyCached =
      await marginEngineCompound.getCachedHistoricalApy();

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
      // termStartTimestampBN,
      // termEndTimestampBN,
      mockCToken,
      marginEngineCompound,
      vammCompound,
      fcmCompound,
    } = await loadFixture(metaFixture));

    console.log(
      "contracts",
      token.address,
      mockCToken.address,
      marginEngineCompound.address,
      vammCompound.address,
      fcmCompound.address
    );

    // update marginEngineCompound allowance
    await token.approve(
      marginEngineCompound.address,
      BigNumber.from(10).pow(27)
    );

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

    await marginEngineCompound.setMarginCalculatorParameters(
      margin_engine_params
    );

    await marginEngineCompound.setLookbackWindowInSeconds(86400);
  });

  describe("#fcm", () => {
    beforeEach(
      "initialize the pool at price of 1:1 TODO: MODIFY FOR COMPOUND",
      async () => {
        await token.mint(other.address, BigNumber.from(10).pow(27));
        await token
          .connect(other)
          .approve(marginEngineCompound.address, BigNumber.from(10).pow(27));

        // mint underlyings to the mock cToken
        await token.mint(mockCToken.address, BigNumber.from(10).pow(27));

        // mint aTokens
        await mockCToken.mint(wallet.address, toBn("100"));
        await mockCToken
          .connect(wallet)
          .approve(fcmCompound.address, toBn("100"));
      }
    );

    it("scenario1", async () => {
      console.log("0");

      expect(await fcmCompound.ctoken(), "ctoken expect").to.eq(mockCToken);
      console.log("0a");

      expect(
        await fcmCompound.marginEngine(),
        "margin engine address expect"
      ).to.eq(marginEngineCompound.address);
      console.log("0b");
      expect(
        await fcmCompound.underlyingYieldBearingToken(),
        "underlying yield bearing token expect"
      ).to.eq(mockCToken);
      console.log("0c");
      expect(await fcmCompound.vamm(), "vamm address expect").to.eq(
        vammCompound
      );

      const otherStartingBalance = await token.balanceOf(other.address);

      console.log("1");
      await marginEngineCompound
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          "1121850791579727450"
        );

      await vammCompound.initializeVAMM(
        TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString()
      );
      console.log("2");

      await vammCompound
        .connect(other)
        .mint(other.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      const traderStartingOverallBalanceInUnderlyingTokens =
        await getTraderBalance(wallet.address);

      const allowance = await mockCToken
        .connect(wallet)
        .allowance(wallet.address, fcmCompound.address);
      console.log("allowance", allowance.toString());

      // engage in a fixed taker swap via the fcm
      await fcmCompound
        .connect(wallet)
        .initiateFullyCollateralisedFixedTakerSwap(
          toBn("100"),
          TickMath.getSqrtRatioAtTick(TICK_SPACING).toString()
        );

      console.log("5");

      // do a full scenario with checks
      const traderInfo = await fcmCompound.traders(wallet.address);
      printTraderWithYieldBearingTokensInfo(traderInfo);

      expect(traderInfo.variableTokenBalance).to.eq(toBn("-100")); // variable token balance the opposite of notional

      // time passes, trader's margin in yield bearing tokens should be the same as the ctoken balance of the fcm
      await advanceTime(604800); // advance time by one week
      await mockCToken.setExchangeRate(
        Math.floor(1.0015 * 10000 + 0.5).toString() + "0".repeat(23)
      );
      await rateOracleTest.writeOracleEntry();

      await printHistoricalApy();

      console.log("7");

      // check a token balance of the fcm
      const cTokenBalanceOfFCM = await mockCToken.balanceOf(
        fcmCompound.address
      );

      console.log("cTokenBalanceOfFCM", utils.formatEther(cTokenBalanceOfFCM));

      // check trader balance
      const cTokenBalanceOfTrader = await fcmCompound.getTraderMarginInCTokens(
        wallet.address
      );

      console.log(
        "cTokenBalanceOfTrader",
        utils.formatEther(cTokenBalanceOfTrader)
      );

      expect(cTokenBalanceOfFCM).to.eq(cTokenBalanceOfTrader);

      await fcmCompound.settleTrader();

      const traderInfoPostSettlement = await fcmCompound.traders(
        wallet.address
      );
      printTraderWithYieldBearingTokensInfo(traderInfoPostSettlement);

      expect(traderInfoPostSettlement.fixedTokenBalance).to.eq(0);
      expect(traderInfoPostSettlement.variableTokenBalance).to.eq(0);
      expect(traderInfoPostSettlement.marginInScaledYieldBearingTokens).to.eq(
        0
      );
      expect(traderInfoPostSettlement.isSettled).to.eq(true);

      const traderEndingOverallBalanceInUnderlyingTokens =
        await getTraderBalance(wallet.address);

      console.log("8");

      const traderAPY = getTraderApy(
        traderStartingOverallBalanceInUnderlyingTokens,
        traderEndingOverallBalanceInUnderlyingTokens
      );

      expect(traderAPY).to.be.near(toBn("0.010116042450876211")); // around 1% fixed apy secured as expected

      // lp settles and collects their margin
      await marginEngineCompound.settlePosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );

      const positionInfo = await marginEngineCompound.callStatic.getPosition(
        other.address,
        -TICK_SPACING,
        TICK_SPACING
      );
      const finalPositionMargin = positionInfo.margin;
      console.log(
        "finalPositionMargin",
        utils.formatEther(finalPositionMargin)
      );

      console.log("9");

      await marginEngineCompound
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          mul(finalPositionMargin, toBn("-1")).add(1)
        );

      console.log("here?");
      const positionInfoPostUpdateMargin =
        await marginEngineCompound.callStatic.getPosition(
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
