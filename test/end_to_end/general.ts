import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import {
  E2ESetupFixture,
  fixedAndVariableMathFixture,
  sqrtPriceMathFixture,
  tickMathFixture,
} from "../shared/fixtures";
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
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import {
  E2ESetup,
  ERC20Mock,
  Factory,
  FixedAndVariableMathTest,
  MockAaveLendingPool,
  SqrtPriceMathTest,
  TestRateOracle,
  TickMathTest,
} from "../../typechain";
import { consts } from "../helpers/constants";
import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import { Minter } from "../../typechain/Minter";
import { Swapper } from "../../typechain/Swapper";
import { e2eParameters, e2eScenarios } from "../shared/e2eSetup";
import { createMetaFixtureE2E } from "../shared/fixtures";
import { expect } from "chai";
import { ConstructorFragment } from "ethers/lib/utils";

const createFixtureLoader = waffle.createFixtureLoader;

const { provider } = waffle;

const AGRESSIVE_SIGMA_SQUARED: BigNumber = toBn("0.15");

const scenarios_to_run = [0];

for (let i of scenarios_to_run) {
    console.log("scenario", i);
    const e2eParams = e2eScenarios[i];

    // print scenario params

    let owner: Wallet;
    let factory: Factory;
    let token: ERC20Mock;
    let rateOracleTest: TestRateOracle;

    let termStartTimestampBN: BigNumber;
    let termEndTimestampBN: BigNumber;

    let vammTest: TestVAMM;
    let marginEngineTest: TestMarginEngine;
    let aaveLendingPool: MockAaveLendingPool;

    let testMarginCalculator: MarginCalculatorTest;
    let marginCalculatorParams: any;

    let testFixedAndVariableMath: FixedAndVariableMathTest;
    let testTickMath: TickMathTest;
    let testSqrtPriceMath: SqrtPriceMathTest;

    let e2eSetup: E2ESetup;
    let minters: Minter[];
    let swappers: Swapper[];

    let positions: [string, number, number][] = [];
    let traders: string[] = [];

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    // global variables (to avoid recomputing them)
    let lowerApyBound: BigNumber = toBn("0");
    let historicalApyWad: BigNumber = toBn("0");
    let upperApyBound: BigNumber = toBn("0");

    let variableFactorWad: BigNumber = toBn("0");

    let currentTick: number = 0;

    async function mintAndApprove(address: string) {
        await token.mint(address, BigNumber.from(10).pow(27));
        await token.approve(address, BigNumber.from(10).pow(27));
    }

    before("fixture loaders", async () => {
        owner = provider.getWallets()[0];
        provider.getSigner();

        loadFixture = createFixtureLoader([owner]);

        ({
            factory,
            token,
            rateOracleTest,
            aaveLendingPool,
            termStartTimestampBN,
            termEndTimestampBN,
            testMarginCalculator,
          } = await loadFixture(await createMetaFixtureE2E(e2eParams)));
      
          // deploy an IRS instance
          await factory.deployIrsInstance(
            token.address,
            rateOracleTest.address,
            termStartTimestampBN,
            termEndTimestampBN
          );

          // deploy margin engine test
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
            
          // deploy VAMM test
          const vammAddress = await factory.getVAMMAddress(
            token.address,
            rateOracleTest.address,
            termStartTimestampBN,
            termEndTimestampBN
          );

          const vammTestFactory = await ethers.getContractFactory("TestVAMM");
          vammTest = vammTestFactory.attach(vammAddress);

          // deploy Fixed and Variable Math test
          ({ testFixedAndVariableMath } = await loadFixture(
            fixedAndVariableMathFixture
          ));

          // deploy Tick Math Test
          ({ testTickMath } = await loadFixture(tickMathFixture));

          // deploy Sqrt Price Math Test
          ({ testSqrtPriceMath } = await loadFixture(sqrtPriceMathFixture));
      
          // deploy the setup for E2E testing
          ({ e2eSetup } = await loadFixture(E2ESetupFixture));
      
          // set the parameters of margin calculator
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

          // set margin engine parameters
          await marginEngineTest.setVAMMAddress(vammTest.address);
          await marginEngineTest.setMarginCalculatorParameters(marginCalculatorParams);
          await marginEngineTest.setSecondsAgo(consts.ONE_WEEK);
      
          // set VAMM parameters
          await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          await vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(TICK_SPACING));
          await vammTest.setTickSpacing(TICK_SPACING);
          await vammTest.setFeeProtocol(0);
          await vammTest.setFee(0);
      
          // set e2e setup parameters
          await e2eSetup.setMEAddress(marginEngineTest.address);
          await e2eSetup.setVAMMAddress(vammTest.address);
          await e2eSetup.setRateOracleAddress(rateOracleTest.address);
      
          // mint and approve the addresses 
          await mintAndApprove(owner.address);
          await mintAndApprove(marginEngineTest.address);
          await mintAndApprove(e2eSetup.address);
      
          // create the minters and swappers
          minters = [];
          for (let i = 0; i < e2eParams.numMinters; i++) {
            const MinterFactory = await ethers.getContractFactory("Minter");
            const minter = await MinterFactory.deploy();
            minters.push(minter);
            await mintAndApprove(minter.address);
          }
      
          swappers = [];
          for (let i = 0; i < e2eParams.numSwappers; i++) {
            const SwapperFactory = await ethers.getContractFactory("Swapper");
            const swapper = await SwapperFactory.deploy();
            swappers.push(swapper);
            await mintAndApprove(swapper.address);
          }
      
          await token.approveInternal(e2eSetup.address, marginEngineTest.address, BigNumber.from(10).pow(27));

          positions = [];
          for (let p of e2eParams.positions) {
            positions.push([minters[p[0]].address, p[1], p[2]]);
          }

          traders = [];
          for (let t of e2eParams.traders) {
            traders.push(swappers[t].address);
          }
    });

    // print the position information
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

    // print the trader information
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

    // print the position and trader information
    async function printPositionsAndTradersInfo(
        positions: [string, number, number][],
        traders: string[]
      ) {
        for (let i = 0; i < positions.length; i++) {
          await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
              positions[i][0],
              positions[i][1],
              positions[i][2]);
  
          console.log("POSITION: ", i + 1);
          console.log("TICK LOWER", positions[i][1]);
          console.log("TICK UPPER", positions[i][2]);
          const positionInfo = await marginEngineTest.getPosition(
            positions[i][0],
            positions[i][1],
            positions[i][2]
          );
  
          await printPositionInfo(positionInfo);
        }
  
        for (let i = 0; i < traders.length; i++) {
          console.log("TRADER: ", i + 1);
          const traderInfo = await marginEngineTest.traders(traders[i]);
          await printTraderInfo(traderInfo);
        }
    }

    // print the current normalized income
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
  
        upperApyBound = await testMarginCalculator.computeApyBound(
          termEndTimestampBN,
          currrentTimestampWad,
          historicalApyWad,
          true,
          marginCalculatorParams
        );
        lowerApyBound = await testMarginCalculator.computeApyBound(
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
    }

    // reserveNormalizedIncome format: x.yyyy
    async function advanceAndUpdateApy(
        time: BigNumber,
        blockCount: number,
        reserveNormalizedIncome: number
      ) {
        await advanceTimeAndBlock(time, blockCount);
  
        console.log(
          "reserveNormalizedIncome in 1e27",
          reserveNormalizedIncome.toString().replace(".", "") + "0".repeat(23)
        );
        await aaveLendingPool.setReserveNormalizedIncome(
          token.address,
          Math.floor(reserveNormalizedIncome * 10000).toString() + "0".repeat(23)
        );
  
        await rateOracleTest.writeOracleEntry();
  
        await printReserveNormalizedIncome();
  
        await updateAPYbounds();
      }

    async function printAPYboundsAndPositionMargin(
        position: [string, number, number],
        liquidity: BigNumber
      ) {
        await updateAPYbounds();

        currentTick = await vammTest.getCurrentTick();
        console.log("current tick: ", currentTick);
  
        const positionInfo = await marginEngineTest.getPosition(position[0], position[1], position[2]);

        const position_margin_requirement_params = {
          owner: position[0],
          tickLower: position[1],
          tickUpper: position[2],
          isLM: false,
          currentTick: currentTick,
          termStartTimestampWad: termStartTimestampBN,
          termEndTimestampWad: termEndTimestampBN,
          liquidity: liquidity.add(positionInfo._liquidity),
          fixedTokenBalance: positionInfo.fixedTokenBalance,
          variableTokenBalance: positionInfo.variableTokenBalance,
          variableFactorWad: variableFactorWad,
          historicalApyWad: historicalApyWad,
        };
  
        const positionMarginRequirement =
          await testMarginCalculator.getPositionMarginRequirementTest(
            position_margin_requirement_params,
            marginCalculatorParams
          );
  
        console.log(
          "position margin requirement: ",
          utils.formatEther(positionMarginRequirement)
        );
        console.log("");

        return positionMarginRequirement;
      }

      async function printAPYboundsAndTraderMargin(trader: Wallet) {
        await updateAPYbounds();
  
        const traderInfo = await marginEngineTest.traders(trader.address);
  
        const trader_margin_requirement_params = {
          fixedTokenBalance: traderInfo.fixedTokenBalance,
          variableTokenBalance: traderInfo.variableTokenBalance,
          termStartTimestampWad: termStartTimestampBN,
          termEndTimestampWad: termEndTimestampBN,
          isLM: false,
          historicalApyWad: historicalApyWad,
        };
  
        const traderMarginRequirement =
          await testMarginCalculator.getTraderMarginRequirement(
            trader_margin_requirement_params,
            marginCalculatorParams
          );
  
        console.log(
          "trader margin requirement: ",
          utils.formatEther(traderMarginRequirement)
        );
  
        console.log("");
  
        return traderMarginRequirement;
      }

      async function printAmounts(
        lowerTick: number,
        upperTick: number,
        liquidityBn: BigNumber
      ) {
        const ratioAtLowerTick = await testTickMath.getSqrtRatioAtTick(lowerTick);
        const ratioAtUpperTick = await testTickMath.getSqrtRatioAtTick(upperTick);
  
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

        return [
            parseFloat(utils.formatEther(amount0)),
            parseFloat(utils.formatEther(amount1)),
          ];
      }

      async function settlePositionsAndTraders(
        positions: [string, number, number][],
        traders: string[]
      ) {
        for (let i = 0; i < positions.length; i++) {
          await marginEngineTest.settlePosition({
            owner: positions[i][0],
            tickLower: positions[i][1],
            tickUpper: positions[i][2],
            liquidityDelta: toBn("0"),
          });
        }
  
        for (let i = 0; i < traders.length; i++) {
          await marginEngineTest.settleTrader(traders[i]);
        }
      }

      async function updateCurrentTick() {
        currentTick = await vammTest.getCurrentTick();
        console.log("current tick: ", currentTick);
      }

      it("full scenario", async () => {
        console.log(
          "----------------------------START----------------------------"
        );
  
        await printReserveNormalizedIncome();

        // add 1,000,000 liquidity to Position 0
        {
            // print the position margin requirement
            await printAPYboundsAndPositionMargin(positions[0], toBn("1000000"));

            // update the position margin with 210
            await e2eSetup.updatePositionMargin(
                {
                  owner: positions[0][0],
                  tickLower: positions[0][1],
                  tickUpper: positions[0][2],
                  liquidityDelta: toBn("0"),
                },
                toBn("210")
              );

            // add 1,000,000 liquidity to Position 0
            await e2eSetup.mint(
                positions[0][0],
                positions[0][1],
                positions[0][2],
                toBn("1000000")
              );
        }
  
        // two days pass and set reserve normalised income
        await advanceAndUpdateApy(consts.ONE_DAY.mul(2), 1, 1.0081); // advance 2 days
  
        // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
        {
            console.log(
                "----------------------------BEFORE FIRST SWAP----------------------------"
              );
            await printPositionsAndTradersInfo(positions, traders);

            // update the trader margin with 1,000
            await e2eSetup.updateTraderMargin(traders[0], toBn("1000"));

            // print the maximum amount given the liquidity of Position 0
            await updateCurrentTick();

            await printAmounts(positions[0][1], currentTick, toBn("1000000"));

            // Trader 0 buys 2,995 VT
            await e2eSetup.swap({
                recipient: traders[0],
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
            await printPositionsAndTradersInfo(positions, traders);
        }
  
        const currentTickAfterFirstSwap = await vammTest.getCurrentTick();
        console.log("current tick: ", currentTickAfterFirstSwap);
  
        // one week passes
        await advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.01);
        await printReserveNormalizedIncome();

        // add 5,000,000 liquidity to Position 1
        {
            // print the position margin requirement
            await printAPYboundsAndPositionMargin(positions[1], toBn("5000000"));

            // update the position margin with 2,000
            await e2eSetup.updatePositionMargin(
                {
                  owner: positions[1][0],
                  tickLower: positions[1][1],
                  tickUpper: positions[1][2],
                  liquidityDelta: 0,
                },
                toBn("2000")
              );

            // add 5,000,000 liquidity to Position 1
            await e2eSetup.mint(
                positions[1][0],
                positions[1][1],
                positions[1][2],
                toBn("5000000")
              );
        }


        // a week passes
        await advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.0125); 

        // Trader 1 engages in a swap
        {
            console.log(
                "----------------------------BEFORE SECOND SWAP----------------------------"
              );
            await printPositionsAndTradersInfo(positions, traders);

            // update the trader margin with 1,000
            await e2eSetup.updateTraderMargin(traders[1], toBn("1000"));

            // print the maximum amount given the liquidity of Position 0
            await updateCurrentTick();

            await printAmounts(positions[0][1], currentTick, toBn("1000000"));
            await printAmounts(positions[1][1], currentTick, toBn("5000000"));

            // Trader 1 buys 15,000 VT
            await e2eSetup.swap({
                recipient: traders[1],
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
            await printPositionsAndTradersInfo(positions, traders);
        }

        // Trader 0 engages in a reverse swap
        {
            console.log(
                "----------------------------BEFORE THIRD (REVERSE) SWAP----------------------------"
              );
            await printPositionsAndTradersInfo(positions, traders);

            // Trader 0 sells 10,000 VT
            await e2eSetup.swap({
                recipient: traders[0],
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
            await printPositionsAndTradersInfo(positions, traders);
        }

        await updateCurrentTick();
  
        // two weeks pass
        await advanceAndUpdateApy(consts.ONE_WEEK.mul(2), 2, 1.0130); // advance two weeks
  
        // burn all liquidity of Position 0
        {
            await e2eSetup.burn(
            positions[0][0],
            positions[0][1],
            positions[0][2],
            toBn("1000000")
          );
        }
  
        await advanceAndUpdateApy(consts.ONE_WEEK.mul(8), 4, 1.0132); // advance eight weeks (4 days before maturity)
  
        await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity
  
        // settle positions and traders
        await settlePositionsAndTraders(positions, traders);
  
        console.log(
          "----------------------------FINAL----------------------------"
        );
        await printPositionsAndTradersInfo(positions, traders);
      });
}
