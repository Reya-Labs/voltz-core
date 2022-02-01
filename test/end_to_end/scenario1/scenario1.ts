import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../../typechain/TestVAMM";
import { expect } from "../../shared/expect";
import {
  fixedAndVariableMathFixture,
  metaFixtureScenario1E2E,
  sqrtPriceMathFixture,
  tickMathFixture,
} from "../../shared/fixtures";
import {
  TICK_SPACING,
  getMaxLiquidityPerTick,
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  encodeSqrtRatioX96,
  formatRay,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  decodePriceSqrt,
} from "../../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../../typechain/TestMarginEngine";
import {
  ERC20Mock,
  Factory,
  FixedAndVariableMathTest,
  MockAaveLendingPool,
  TestRateOracle,
} from "../../../typechain";
import { consts } from "../../helpers/constants";
import { MarginCalculatorTest } from "../../../typechain/MarginCalculatorTest";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";

const createFixtureLoader = waffle.createFixtureLoader;

const { provider } = waffle;

const AGRESSIVE_SIGMA_SQUARED: BigNumber = toBn("0.15");

describe("VAMM", () => {
  let owner: Wallet;
  const LPWallets: Wallet[] = [];
  const TWallets: Wallet[] = [];
  let token: ERC20Mock;
  let factory: Factory;
  let rateOracleTest: TestRateOracle;
  let termStartTimestampBN: BigNumber;
  let termEndTimestampBN: BigNumber;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;
  let testMarginCalculator: MarginCalculatorTest;
  let testFixedAndVariableMath: FixedAndVariableMathTest;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    const numLPWalletsRequested = 2;
    const numTWalletsRequested = 2;

    const allWallets = provider.getWallets();

    owner = allWallets[0];
    for (let i = 1; i < numLPWalletsRequested + 1; i++) {
      LPWallets.push(allWallets[i]);
    }
    for (
      let i = numLPWalletsRequested + 1;
      i < numLPWalletsRequested + numTWalletsRequested + 1;
      i++
    ) {
      TWallets.push(allWallets[i]);
    }

    loadFixture = createFixtureLoader(
      allWallets.slice(0, numLPWalletsRequested + numTWalletsRequested + 1)
    );
  });

  beforeEach("deploy fixture", async () => {
    ({
      factory,
      token,
      rateOracleTest,
      aaveLendingPool,
      termStartTimestampBN,
      termEndTimestampBN,
      testMarginCalculator,
    } = await loadFixture(metaFixtureScenario1E2E));

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
    await marginEngineTest.setVAMMAddress(vammTest.address);

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    const marginCalculatorParams = {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      sigmaSquaredWad: AGRESSIVE_SIGMA_SQUARED,
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,
    };

    await marginEngineTest.setMarginCalculatorParameters(
      marginCalculatorParams
    );
    await marginEngineTest.setSecondsAgo(consts.ONE_WEEK);

    const allWallets = [owner].concat(LPWallets).concat(TWallets);
    for (let i = 0; i < allWallets.length; i++) {
      await token.mint(allWallets[i].address, BigNumber.from(10).pow(27));
      await token.approve(allWallets[i].address, BigNumber.from(10).pow(27));
    }

    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(TICK_SPACING));
    await vammTest.setTickSpacing(TICK_SPACING);

    // set the fees differently in scenario 2
    await vammTest.setFeeProtocol(0);
    await vammTest.setFee(0);

    ({ testFixedAndVariableMath } = await loadFixture(
      fixedAndVariableMathFixture
    ));
  });

  describe("#Scenario1", () => {
    let variableFactorWad: BigNumber;

    async function printPositionInfo(positionInfo: any) {
      console.log(
        "                        liquidity: ",
        utils.formatEther(positionInfo[0])
      );
      console.log(
        "                           margin: ",
        utils.formatEther(positionInfo[1])
      );
      console.log(
        "   fixedTokenGrowthInsideLastX128: ",
        positionInfo[2].div(BigNumber.from(2).pow(128 - 32)).toNumber() /
          2 ** 32
      );
      console.log(
        "variableTokenGrowthInsideLastX128: ",
        positionInfo[3].div(BigNumber.from(2).pow(128 - 32)).toNumber() /
          2 ** 32
      );
      console.log(
        "                fixedTokenBalance: ",
        utils.formatEther(positionInfo[4])
      );
      console.log(
        "             variableTokenBalance: ",
        utils.formatEther(positionInfo[5])
      );
      console.log(
        "          feeGrowthInsideLastX128: ",
        positionInfo[6].div(BigNumber.from(2).pow(128 - 32)).toNumber() /
          2 ** 32
      );
      console.log(
        "                        isSettled: ",
        positionInfo[7].toString()
      );

      const settlementCashflow =
        await testFixedAndVariableMath.calculateSettlementCashflow(
          positionInfo[4],
          positionInfo[5],
          termStartTimestampBN,
          termEndTimestampBN,
          variableFactorWad
        );
      console.log(
        "             settlement cashflow: ",
        utils.formatEther(settlementCashflow)
      );

      console.log("");
    }

    async function printTraderInfo(traderInfo: any) {
      console.log("              margin: ", utils.formatEther(traderInfo[0]));
      console.log("   fixedTokenBalance: ", utils.formatEther(traderInfo[1]));
      console.log("variableTokenBalance: ", utils.formatEther(traderInfo[2]));
      console.log("           isSettled: ", traderInfo[3].toString());

      const settlementCashflow =
        await testFixedAndVariableMath.calculateSettlementCashflow(
          traderInfo[1],
          traderInfo[2],
          termStartTimestampBN,
          termEndTimestampBN,
          variableFactorWad
        );
      console.log(
        "settlement cashflow: ",
        utils.formatEther(settlementCashflow)
      );

      console.log("");
    }

    async function printPositionsAndTradersInfo(
      positions: [Wallet, number, number][],
      traders: Wallet[],
      positions_to_update: number[]
    ) {
      for (let i = 0; i < positions.length; i++) {
        if (positions_to_update.includes(i)) {
          await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
            positions[i][0].address,
            positions[i][1],
            positions[i][2]
          );
        }

        console.log("POSITION: ", i + 1);
        console.log("TICK LOWER", positions[i][1]);
        console.log("TICK UPPER", positions[i][2]);
        const positionInfo = await marginEngineTest.getPosition(
          positions[i][0].address,
          positions[i][1],
          positions[i][2]
        );

        await printPositionInfo(positionInfo);
      }

      for (let i = 0; i < traders.length; i++) {
        console.log("TRADER: ", i + 1);
        const traderInfo = await marginEngineTest.traders(traders[i].address);
        await printTraderInfo(traderInfo);
      }
    }

    async function printReserveNormalizedIncome() {
      const currentReseveNormalizedIncome =
        await aaveLendingPool.getReserveNormalizedIncome(token.address);
      console.log(
        "currentReseveNormalisedIncome",
        formatRay(currentReseveNormalizedIncome)
      ); // in ray
      console.log("");
    }

    async function printAPYboundsAndPositionMargin(
      position: [Wallet, number, number],
      liquidity: BigNumber
    ) {
      const marginCalculatorParams = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        sigmaSquaredWad: AGRESSIVE_SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      const currentTimestamp: number = await getCurrentTimestamp(provider);
      const currrentTimestampWad: BigNumber = toBn(currentTimestamp.toString());
      const historicalApyWad: BigNumber =
        await marginEngineTest.getHistoricalApy();

      const upperApyBound = await testMarginCalculator.computeApyBound(
        termEndTimestampBN,
        currrentTimestampWad,
        historicalApyWad,
        true,
        marginCalculatorParams
      );
      const lowerApyBound = await testMarginCalculator.computeApyBound(
        termEndTimestampBN,
        currrentTimestampWad,
        historicalApyWad,
        false,
        marginCalculatorParams
      );

      variableFactorWad = await rateOracleTest.variableFactorNoCache(
        termStartTimestampBN,
        termEndTimestampBN
      );

      console.log(" historical apy:", utils.formatEther(historicalApyWad));
      console.log("upper apy bound:", utils.formatEther(upperApyBound));
      console.log("lower apy bound:", utils.formatEther(lowerApyBound));
      console.log("variable factor:", utils.formatEther(variableFactorWad)); // displayed as zero, investigate
      console.log("");

      const currentTick = await vammTest.getCurrentTick();
      console.log("current tick: ", currentTick);

      const position_margin_requirement_params = {
        owner: position[0].address,
        tickLower: position[1],
        tickUpper: position[2],
        isLM: false,
        currentTick: currentTick,
        termStartTimestampWad: termStartTimestampBN,
        termEndTimestampWad: termEndTimestampBN,
        liquidity: liquidity,
        fixedTokenBalance: toBn("0"),
        variableTokenBalance: toBn("0"),
        variableFactorWad: variableFactorWad,
        historicalApyWad: historicalApyWad,
      };

      const postitionMarginrRequirement =
        await testMarginCalculator.getPositionMarginRequirementTest(
          position_margin_requirement_params,
          marginCalculatorParams
        );

      console.log(
        "position margin requirement: ",
        utils.formatEther(postitionMarginrRequirement)
      );
      console.log("");
    }

    async function printAmounts(
      lowerTick: number,
      upperTick: number,
      liquidityBn: BigNumber
    ) {
      const { testTickMath } = await loadFixture(tickMathFixture);
      const ratioAtLowerTick = await testTickMath.getSqrtRatioAtTick(lowerTick);
      const ratioAtUpperTick = await testTickMath.getSqrtRatioAtTick(upperTick);

      const { testSqrtPriceMath } = await loadFixture(sqrtPriceMathFixture);
      const amount0 = await testSqrtPriceMath.getAmount0Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidityBn,
        true
      );
      const amount1 = await testSqrtPriceMath.getAmount1Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidityBn,
        true
      );

      console.log(
        "PRICE at LOWER tick: ",
        decodePriceSqrt(BigNumber.from(ratioAtLowerTick.toString()))
      );
      console.log(
        "PRICE at UPPER tick: ",
        decodePriceSqrt(BigNumber.from(ratioAtUpperTick.toString()))
      );
      console.log("           AMOUNT 0: ", BigNumber.from(amount0.toString()));
      console.log("           AMOUNT 1: ", BigNumber.from(amount1.toString()));
    }

    async function settlePositionsAndTraders(
      positions: [Wallet, number, number][],
      traders: Wallet[]
    ) {
      for (let i = 0; i < positions.length; i++) {
        await marginEngineTest.settlePosition({
          owner: positions[i][0].address,
          tickLower: positions[i][1],
          tickUpper: positions[i][2],
          liquidityDelta: toBn("0"),
        });
      }

      for (let i = 0; i < traders.length; i++) {
        await marginEngineTest.settleTrader(traders[i].address);
      }
    }

    it("full scenario 1", async () => {
      const positions: [Wallet, number, number][] = [
        [LPWallets[0], -TICK_SPACING, TICK_SPACING],
        [LPWallets[1], -3 * TICK_SPACING, -TICK_SPACING],
      ];

      const traders = TWallets;

      console.log(
        "----------------------------START----------------------------"
      );

      await printReserveNormalizedIncome();

      // check apy bounds

      printAPYboundsAndPositionMargin(positions[0], toBn("1000000"));

      // LP 1 deposits margin and mints liquidity right after the pool initialisation
      // Should trigger a write to the rate oracle

      /// todo: connect the positon address
      await marginEngineTest.updatePositionMargin(
        {
          owner: positions[0][0].address,
          tickLower: positions[0][1],
          tickUpper: positions[0][2],
          liquidityDelta: 0,
        },
        toBn("180")
      );

      await expect(
        vammTest
          .connect(positions[0][0])
          .mint(
            positions[0][0].address,
            positions[0][1],
            positions[0][2],
            toBn("1000000")
          )
      ).to.be.reverted;

      await marginEngineTest.updatePositionMargin(
        {
          owner: positions[0][0].address,
          tickLower: positions[0][1],
          tickUpper: positions[0][2],
          liquidityDelta: 0,
        },
        toBn("30")
      );

      await vammTest
        .connect(positions[0][0])
        .mint(
          positions[0][0].address,
          positions[0][1],
          positions[0][2],
          toBn("1000000")
        );

      // two days pass and set reserve normalised income

      await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1); // advance 2 days

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1008100000000000000000000000" // 10^27 * 1.0081
      );

      await rateOracleTest.writeOracleEntry();

      // Trader 1 engages in  a swap that (almost) consumes all of the liquidity of LP 1

      await marginEngineTest.updateTraderMargin(
        traders[0].address,
        toBn("1000")
      );

      console.log(
        "----------------------------BEFORE FIRST SWAP----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders, []);

      // price is at tick 0, so we need to see the amount below
      await printAmounts(-TICK_SPACING, 0, toBn("1000000"));

      await vammTest.connect(traders[0]).swap({
        recipient: traders[0].address,
        isFT: false,
        amountSpecified: toBn("-2995"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });

      console.log(
        "----------------------------AFTER FIRST SWAP----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders, [0]);

      const currentTickAfterFirstSwap = await vammTest.getCurrentTick();
      console.log("current tick: ", currentTickAfterFirstSwap);

      // one week passes

      await advanceTimeAndBlock(consts.ONE_WEEK, 2); // advance one week

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1010000000000000000000000000" // 10^27 * 1.010
      );

      await rateOracleTest.writeOracleEntry();

      await printReserveNormalizedIncome();

      // check apy bounds

      await printAPYboundsAndPositionMargin(positions[1], toBn("5000000"));

      // LP 2 deposits margin and mints liquidity
      // Should trigger a write to the rate oracle

      await marginEngineTest.updatePositionMargin(
        {
          owner: positions[1][0].address,
          tickLower: positions[1][1],
          tickUpper: positions[1][2],
          liquidityDelta: 0,
        },
        toBn("2000")
      );

      await vammTest
        .connect(positions[1][0])
        .mint(
          positions[1][0].address,
          positions[1][1],
          positions[1][2],
          toBn("5000000")
        );

      // a week passes

      await advanceTimeAndBlock(consts.ONE_WEEK, 2); // advance one week

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1012500000000000000000000000" // 10^27 * 1.0125
      );

      await rateOracleTest.writeOracleEntry();

      // Trader 2 engages in a swap and consumes some liquidity of LP 2

      await marginEngineTest.updateTraderMargin(
        traders[1].address,
        toBn("1000")
      );

      console.log(
        "----------------------------BEFORE SECOND SWAP----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders, []);

      await vammTest.connect(traders[1]).swap({
        recipient: traders[1].address,
        isFT: false,
        amountSpecified: toBn("-15000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });

      console.log(
        "----------------------------AFTER SECOND SWAP----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders, [0, 1]);

      const currentTickAfterSecondsSwap = await vammTest.getCurrentTick();
      console.log("current tick: ", currentTickAfterSecondsSwap);

      // Trader 1 engages in a reverse swap

      await vammTest.connect(traders[0]).swap({
        recipient: traders[0].address,
        isFT: true,
        amountSpecified: toBn("10000"),
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });

      console.log(
        "----------------------------AFTER THIRD (REVERSE) SWAP----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders, [0, 1]);

      const currentTick = await vammTest.getCurrentTick();
      console.log("current tick: ", currentTick);

      // two weeks pass

      await advanceTimeAndBlock(consts.ONE_WEEK.mul(2), 2); // advance two weeks

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1013000000000000000000000000" // 10^27 * 1.0130
      );

      await rateOracleTest.writeOracleEntry();

      // LP 1 burns all of their liquidity, no trader can engage in swaps with this LP anymore

      await vammTest
        .connect(positions[0][0])
        .burn(
          positions[0][0].address,
          positions[0][1],
          positions[0][2],
          toBn("1000000")
        );

      await advanceTimeAndBlock(consts.ONE_WEEK.mul(8), 4); // advance eight weeks (4 days before maturity)

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1013200000000000000000000000" // 10^27 * 1.0132
      );

      await rateOracleTest.writeOracleEntry();

      await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity

      // settle positions and traders
      await settlePositionsAndTraders(positions, traders);

      console.log(
        "----------------------------FINAL----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders, [0, 1]);
    });
  });
});
