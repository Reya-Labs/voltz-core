import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../../typechain/TestVAMM";
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

  let marginCalculatorParams: any;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    const numLPWalletsRequested = 5;
    const numTWalletsRequested = 5;

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

    marginCalculatorParams = {
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

  describe("#Scenario2", () => {
    let variableFactorWad: BigNumber;
    let historicalApyWad: BigNumber;
    let currentTick: number;

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
      traders: Wallet[]
    ) {
      for (let i = 0; i < positions.length; i++) {
        await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
          positions[i][0].address,
          positions[i][1],
          positions[i][2]
        );

        console.log("POSITION: ", i + 1);
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

    async function updateAPYbounds() {
      const currentTimestamp: number = await getCurrentTimestamp(provider);
      const currrentTimestampWad: BigNumber = toBn(currentTimestamp.toString());
      historicalApyWad = await marginEngineTest.getHistoricalApy();

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

      currentTick = await vammTest.getCurrentTick();
      console.log("current tick: ", currentTick);
    }

    async function printAPYboundsAndPositionMargin(
      position: [Wallet, number, number],
      liquidity: BigNumber
    ) {
      await updateAPYbounds();

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

      console.log("PRICE at LOWER tick: ", decodePriceSqrt(ratioAtLowerTick));
      console.log("PRICE at UPPER tick: ", decodePriceSqrt(ratioAtUpperTick));
      console.log("           AMOUNT 0: ", utils.formatEther(amount0));
      console.log("           AMOUNT 1: ", utils.formatEther(amount1));
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

    it("full scenario 2", async () => {
      const positions: [Wallet, number, number][] = [];
      const traders = TWallets;

      for (let i = 0; i < LPWallets.length; i++) {
        positions.push([LPWallets[i], -TICK_SPACING, 0]);
      }
      console.log("length of positions:", positions.length);

      console.log(
        "----------------------------START----------------------------"
      );

      for (let j = 0; j < positions.length; j++) {
        printAPYboundsAndPositionMargin(positions[j], toBn("101000"));
        // 20.409

        await marginEngineTest.updatePositionMargin(
          {
            owner: positions[j][0].address,
            tickLower: positions[j][1],
            tickUpper: positions[j][2],
            liquidityDelta: 0,
          },
          toBn("25")
        );
      }

      // each LP deposits 1,010 liquidity 100 times
      await rateOracleTest.testGrow(1000);

      for (let i = 0; i < 100; i++) {
        console.log(i);
        for (let j = 0; j < positions.length; j++) {
          await vammTest
            .connect(positions[j][0])
            .mint(
              positions[j][0].address,
              positions[j][1],
              positions[j][2],
              toBn("1001")
            );
        }
        // await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);

        // await aaveLendingPool.setReserveNormalizedIncome(
        //     token.address,
        //     "1001200000000000000000000000" // 10^27 * 1.0012
        //   );

        // await rateOracleTest.writeOracleEntry();

        // await printReserveNormalizedIncome();
      }

      await advanceTimeAndBlock(consts.ONE_DAY.mul(25), 1);

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1001200000000000000000000000" // 10^27 * 1.0012
      );

      await rateOracleTest.writeOracleEntry();

      await printReserveNormalizedIncome();

      await printAmounts(-TICK_SPACING, 0, toBn("505000"));
      // > 1500 variable tokens available to trade

      for (let j = 0; j < traders.length; j++) {
        await marginEngineTest.updateTraderMargin(
          traders[j].address,
          toBn("100")
        );
      }

      // each Trader trades 3 variable tokens 100 times
      await rateOracleTest.testGrow(2000);

      for (let i = 0; i < 100; i++) {
        console.log(i);
        for (let j = 0; j < traders.length; j++) {
          await vammTest.connect(traders[j]).swap({
            recipient: traders[j].address,
            isFT: false,
            amountSpecified: toBn("-3"),
            sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
            isUnwind: false,
            isTrader: true,
            tickLower: 0,
            tickUpper: 0,
          });
        }
        // await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);

        // await aaveLendingPool.setReserveNormalizedIncome(
        //     token.address,
        //     "1001200000000000000000000000" // 10^27 * 1.0012
        //   );

        // await rateOracleTest.writeOracleEntry();

        // await printReserveNormalizedIncome();
      }

      await advanceTimeAndBlock(consts.ONE_DAY.mul(25), 1);

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1001200000000000000000000000" // 10^27 * 1.0012
      );

      await rateOracleTest.writeOracleEntry();

      await printReserveNormalizedIncome();

      await updateAPYbounds();

      console.log(
        "----------------------------BEFORE SETTLEMENT----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders);

      await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 1);

      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        "1001500000000000000000000000" // 10^27 * 1.0015
      );

      await rateOracleTest.writeOracleEntry();

      await printReserveNormalizedIncome();

      // settle positions and traders
      await settlePositionsAndTraders(positions, traders);

      console.log(
        "----------------------------FINAL----------------------------"
      );
      await printPositionsAndTradersInfo(positions, traders);
    });
  });
});
