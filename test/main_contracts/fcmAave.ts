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
  // TestRateOracle,
} from "../../typechain";
import { TickMath } from "../shared/tickMath";
import { advanceTime } from "../helpers/time";

const createFixtureLoader = waffle.createFixtureLoader;

// more vamm tests!

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  // let factory: Factory;
  // let rateOracleTest: TestRateOracle;
  // let termStartTimestampBN: BigNumber;
  // let termEndTimestampBN: BigNumber;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;
  let aaveFCM: TestAaveFCM;
  let mockAToken: MockAToken;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      // factory,
      token,
      // rateOracleTest,
      aaveLendingPool,
      // termStartTimestampBN,
      // termEndTimestampBN,
      mockAToken,
      marginEngineTest,
      vammTest
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

    // fcm setup
    const aaveFCMFactory = await ethers.getContractFactory("TestAaveFCM");
    aaveFCM = (await aaveFCMFactory.deploy(
      mockAToken.address,
      vammTest.address,
      marginEngineTest.address,
      aaveLendingPool.address
    )) as TestAaveFCM;

    // set factor per second
    await aaveLendingPool.setFactorPerSecondInRay(token.address, "1000000001000000000000000000");

    // set fcm
    await marginEngineTest.setFCM(aaveFCM.address);

  });

  describe("#fcm", () => {
    beforeEach("initialize the pool at price of 1:1", async () => {
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      const currentReserveNormalisedIncome = await aaveLendingPool.getReserveNormalizedIncome(token.address);

      // mint aTokens
      await mockAToken.mint(wallet.address, toBn("10000"), currentReserveNormalisedIncome);
      await mockAToken.approve(aaveFCM.address, toBn("10000"));

      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        "1121850791579727450"
      );

      await marginEngineTest.updateTraderMargin(wallet.address, toBn("100000"));
    });

    it("scenario1", async () => {
      await vammTest.initializeVAMM(TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString());

      await vammTest.setMaxLiquidityPerTick(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await vammTest.setTickSpacing(TICK_SPACING);

      await vammTest.setFeeProtocol(0);
      await vammTest.setFee(toBn("0"));

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );
      
      // engage in a fixed taker swap via the fcm
      await aaveFCM.initiateFullyCollateralisedFixedTakerSwap(toBn("10"), TickMath.getSqrtRatioAtTick(TICK_SPACING).toString());

      // do a full scenario with checks
      const traderInfo = await aaveFCM.traders(wallet.address);
      printTraderWithYieldBearingTokensInfo(traderInfo);

      expect(traderInfo[2]).to.eq(toBn("-10")); // variable token balance the opposite of notional
        
      // time passes, trader's margin in yield bearing tokens should be the same as the atoken balance of the fcm
      advanceTime(604800); // advance time by one week

      // check a token balance of the fcm
      const aTokenBalanceOfFCM = await mockAToken.balanceOf(aaveFCM.address);
      
      console.log("aTokenBalanceOfFCM", utils.formatEther(aTokenBalanceOfFCM));

      // update trader balances to account for yield accumulation
      

    });

  });
});
