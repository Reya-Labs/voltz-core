// import { ethers, waffle } from "hardhat";
// import { BigNumber, utils, Wallet } from "ethers";
// import { TestVAMM } from "../../../typechain/TestVAMM";
// import { expect } from "../../shared/expect";
// import {
//   fixedAndVariableMathFixture,
//   metaFixtureScenario1E2E,
//   sqrtPriceMathFixture,
//   tickMathFixture,
// } from "../../shared/fixtures";
// import {
//   TICK_SPACING,
//   getMaxLiquidityPerTick,
//   APY_UPPER_MULTIPLIER,
//   APY_LOWER_MULTIPLIER,
//   ALPHA,
//   BETA,
//   XI_UPPER,
//   XI_LOWER,
//   T_MAX,
//   encodeSqrtRatioX96,
//   formatRay,
//   MIN_SQRT_RATIO,
//   MAX_SQRT_RATIO,
//   decodePriceSqrt,
// } from "../../shared/utilities";
// import { toBn } from "evm-bn";
// import { TestMarginEngine } from "../../../typechain/TestMarginEngine";
// import {
//   ERC20Mock,
//   Factory,
//   FixedAndVariableMathTest,
//   MockAaveLendingPool,
//   SqrtPriceMathTest,
//   TestRateOracle,
//   TickMathTest,
// } from "../../../typechain";
// import { consts } from "../../helpers/constants";
// import { MarginCalculatorTest } from "../../../typechain/MarginCalculatorTest";
// import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";

// const createFixtureLoader = waffle.createFixtureLoader;

// const { provider } = waffle;

// const AGRESSIVE_SIGMA_SQUARED: BigNumber = toBn("0.15");

// describe("VAMM", () => {
//   let owner: Wallet;
//   const LPWallets: Wallet[] = [];
//   const TWallets: Wallet[] = [];
//   let token: ERC20Mock;
//   let factory: Factory;
//   let rateOracleTest: TestRateOracle;
//   let termStartTimestampBN: BigNumber;
//   let termEndTimestampBN: BigNumber;
//   let vammTest: TestVAMM;
//   let marginEngineTest: TestMarginEngine;
//   let aaveLendingPool: MockAaveLendingPool;
//   let testMarginCalculator: MarginCalculatorTest;
//   let testFixedAndVariableMath: FixedAndVariableMathTest;
//   let testTickMath: TickMathTest;
//   let testSqrtPriceMath: SqrtPriceMathTest;

//   let marginCalculatorParams: any;

//   let loadFixture: ReturnType<typeof createFixtureLoader>;

//   before("create fixture loader", async () => {
//     const numLPWalletsRequested = 3;
//     const numTWalletsRequested = 3;

//     const allWallets = provider.getWallets();

//     owner = allWallets[0];
//     for (let i = 1; i < numLPWalletsRequested + 1; i++) {
//       LPWallets.push(allWallets[i]);
//     }
//     for (
//       let i = numLPWalletsRequested + 1;
//       i < numLPWalletsRequested + numTWalletsRequested + 1;
//       i++
//     ) {
//       TWallets.push(allWallets[i]);
//     }

//     loadFixture = createFixtureLoader(
//       allWallets.slice(0, numLPWalletsRequested + numTWalletsRequested + 1)
//     );
//   });

//   beforeEach("deploy fixture", async () => {
//     ({
//       factory,
//       token,
//       rateOracleTest,
//       aaveLendingPool,
//       termStartTimestampBN,
//       termEndTimestampBN,
//       testMarginCalculator,
//     } = await loadFixture(metaFixtureScenario1E2E));

//     // deploy a margin engine & vamm
//     await factory.deployIrsInstance(
//       token.address,
//       rateOracleTest.address,
//       termStartTimestampBN,
//       termEndTimestampBN
//     );
//     const marginEngineAddress = await factory.getMarginEngineAddress(
//       token.address,
//       rateOracleTest.address,
//       termStartTimestampBN,
//       termEndTimestampBN
//     );
//     const marginEngineTestFactory = await ethers.getContractFactory(
//       "TestMarginEngine"
//     );
//     marginEngineTest = marginEngineTestFactory.attach(marginEngineAddress);
//     const vammAddress = await factory.getVAMMAddress(
//       token.address,
//       rateOracleTest.address,
//       termStartTimestampBN,
//       termEndTimestampBN
//     );
//     const vammTestFactory = await ethers.getContractFactory("TestVAMM");
//     vammTest = vammTestFactory.attach(vammAddress);
//     await marginEngineTest.setVAMMAddress(vammTest.address);

//     // update marginEngineTest allowance
//     await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

//     marginCalculatorParams = {
//       apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
//       apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
//       sigmaSquaredWad: AGRESSIVE_SIGMA_SQUARED,
//       alphaWad: ALPHA,
//       betaWad: BETA,
//       xiUpperWad: XI_UPPER,
//       xiLowerWad: XI_LOWER,
//       tMaxWad: T_MAX,
//     };

//     await marginEngineTest.setMarginCalculatorParameters(
//       marginCalculatorParams
//     );
//     await marginEngineTest.setSecondsAgo(consts.ONE_WEEK);

//     const allWallets = [owner].concat(LPWallets).concat(TWallets);
//     for (let i = 0; i < allWallets.length; i++) {
//       await token.mint(allWallets[i].address, BigNumber.from(10).pow(27));
//       await token.approve(allWallets[i].address, BigNumber.from(10).pow(27));
//     }

//     await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

//     await vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(TICK_SPACING));
//     await vammTest.setTickSpacing(TICK_SPACING);

//     // set the fees differently
//     await vammTest.setFeeProtocol(0);
//     await vammTest.setFee(toBn("0"));

//     ({ testFixedAndVariableMath } = await loadFixture(
//       fixedAndVariableMathFixture
//     ));
//     ({ testSqrtPriceMath } = await loadFixture(sqrtPriceMathFixture));
//     ({ testTickMath } = await loadFixture(tickMathFixture));
//   });

//   describe("#Scenario5", () => {
//     let variableFactorWad: BigNumber = toBn("0");
//     let historicalApyWad: BigNumber = toBn("0");
//     let lowerApyBound: BigNumber = toBn("0");
//     let upperApyBound: BigNumber = toBn("0");
//     let accumulatedMargin: BigNumber = toBn("0");
//     let currentTick: number = 0;

//     async function updatePositionMargin(
//       position: [Wallet, number, number],
//       liquidityDeltaBn: BigNumber,
//       marginBn: BigNumber
//     ) {
//       await marginEngineTest.updatePositionMargin(
//         {
//           owner: position[0].address,
//           tickLower: position[1],
//           tickUpper: position[2],
//           liquidityDelta: liquidityDeltaBn,
//         },
//         marginBn
//       );

//       accumulatedMargin = accumulatedMargin.add(marginBn);
//     }

//     async function updateTraderMargin(trader: Wallet, marginBn: BigNumber) {
//       await marginEngineTest.updateTraderMargin(trader.address, marginBn);

//       accumulatedMargin = accumulatedMargin.add(marginBn);
//     }

//     async function printPositionInfo(
//       positionInfo: any,
//       accumulator: { value: BigNumber }
//     ) {
//       console.log(
//         "                        liquidity: ",
//         utils.formatEther(positionInfo[0])
//       );
//       console.log(
//         "                           margin: ",
//         utils.formatEther(positionInfo[1])
//       );
//       console.log(
//         "   fixedTokenGrowthInsideLastX128: ",
//         positionInfo[2].div(BigNumber.from(2).pow(128 - 32)).toNumber() /
//           2 ** 32
//       );
//       console.log(
//         "variableTokenGrowthInsideLastX128: ",
//         positionInfo[3].div(BigNumber.from(2).pow(128 - 32)).toNumber() /
//           2 ** 32
//       );
//       console.log(
//         "                fixedTokenBalance: ",
//         utils.formatEther(positionInfo[4])
//       );
//       console.log(
//         "             variableTokenBalance: ",
//         utils.formatEther(positionInfo[5])
//       );
//       console.log(
//         "          feeGrowthInsideLastX128: ",
//         positionInfo[6].div(BigNumber.from(2).pow(128 - 32)).toNumber() /
//           2 ** 32
//       );
//       console.log(
//         "                        isSettled: ",
//         positionInfo[7].toString()
//       );

//       accumulator.value = accumulator.value.add(positionInfo[1]);

//       const settlementCashflow =
//         await testFixedAndVariableMath.calculateSettlementCashflow(
//           positionInfo[4],
//           positionInfo[5],
//           termStartTimestampBN,
//           termEndTimestampBN,
//           variableFactorWad
//         );

//       accumulator.value = accumulator.value.add(settlementCashflow);

//       expect(
//         positionInfo[1].add(settlementCashflow),
//         "margin + settlement cashflow should be > 0"
//       ).to.be.gte(toBn("0"));

//       console.log(
//         "             settlement cashflow: ",
//         utils.formatEther(settlementCashflow)
//       );

//       console.log("");
//     }

//     async function printTraderInfo(
//       traderInfo: any,
//       accumulator: { value: BigNumber }
//     ) {
//       console.log("              margin: ", utils.formatEther(traderInfo[0]));
//       console.log("   fixedTokenBalance: ", utils.formatEther(traderInfo[1]));
//       console.log("variableTokenBalance: ", utils.formatEther(traderInfo[2]));
//       console.log("           isSettled: ", traderInfo[3].toString());

//       accumulator.value = accumulator.value.add(traderInfo[0]);

//       const settlementCashflow =
//         await testFixedAndVariableMath.calculateSettlementCashflow(
//           traderInfo[1],
//           traderInfo[2],
//           termStartTimestampBN,
//           termEndTimestampBN,
//           variableFactorWad
//         );
//       accumulator.value = accumulator.value.add(settlementCashflow);

//       expect(
//         traderInfo[0].add(settlementCashflow),
//         "margin + settlement cashflow should be > 0"
//       ).to.be.gte(toBn("0"));

//       console.log(
//         "settlement cashflow: ",
//         utils.formatEther(settlementCashflow)
//       );

//       console.log("");
//     }

//     async function printPositionsAndTradersInfo(
//       positions: [Wallet, number, number][],
//       traders: Wallet[],
//       positions_to_update: number[]
//     ) {
//       const accumulator = { value: toBn("0") };

//       for (let i = 0; i < positions.length; i++) {
//         if (positions_to_update.includes(i)) {
//           await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
//             positions[i][0].address,
//             positions[i][1],
//             positions[i][2]
//           );
//         }

//         console.log("POSITION: ", i + 1);
//         console.log("TICK LOWER", positions[i][1]);
//         console.log("TICK UPPER", positions[i][2]);
//         const positionInfo = await marginEngineTest.getPosition(
//           positions[i][0].address,
//           positions[i][1],
//           positions[i][2]
//         );

//         await printPositionInfo(positionInfo, accumulator);
//       }

//       for (let i = 0; i < traders.length; i++) {
//         console.log("TRADER: ", i + 1);
//         const traderInfo = await marginEngineTest.traders(traders[i].address);
//         await printTraderInfo(traderInfo, accumulator);
//       }

//       const protocolFees = await vammTest.getProtocolFees();
//       expect(
//         accumulator.value.add(protocolFees),
//         "initial margin should be preserved"
//       ).to.be.near(accumulatedMargin);
//       console.log(
//         "ACCUMULATED SETTLEMENT CASHFLOW AND MARGIN:",
//         utils.formatEther(accumulator.value)
//       );
//       console.log("");
//     }

//     async function printReserveNormalizedIncome() {
//       const currentReseveNormalizedIncome =
//         await aaveLendingPool.getReserveNormalizedIncome(token.address);
//       console.log(
//         "currentReseveNormalisedIncome",
//         formatRay(currentReseveNormalizedIncome)
//       ); // in ray
//       console.log("");
//     }

//     async function updateAPYbounds() {
//       const currentTimestamp: number = await getCurrentTimestamp(provider);
//       const currrentTimestampWad: BigNumber = toBn(currentTimestamp.toString());
//       historicalApyWad = await marginEngineTest.getHistoricalApy();

//       upperApyBound = await testMarginCalculator.computeApyBound(
//         termEndTimestampBN,
//         currrentTimestampWad,
//         historicalApyWad,
//         true,
//         marginCalculatorParams
//       );
//       lowerApyBound = await testMarginCalculator.computeApyBound(
//         termEndTimestampBN,
//         currrentTimestampWad,
//         historicalApyWad,
//         false,
//         marginCalculatorParams
//       );

//       variableFactorWad = await rateOracleTest.variableFactorNoCache(
//         termStartTimestampBN,
//         termEndTimestampBN
//       );

//       console.log(" historical apy:", utils.formatEther(historicalApyWad));
//       console.log("upper apy bound:", utils.formatEther(upperApyBound));
//       console.log("lower apy bound:", utils.formatEther(lowerApyBound));
//       console.log("variable factor:", utils.formatEther(variableFactorWad)); // displayed as zero, investigate
//       console.log("");

//       currentTick = await vammTest.getCurrentTick();
//       console.log("current tick: ", currentTick);
//     }

//     async function printAPYboundsAndPositionMargin(
//       position: [Wallet, number, number],
//       liquidity: BigNumber
//     ) {
//       await updateAPYbounds();

//       const positionInfo = await marginEngineTest.getPosition(
//         position[0].address,
//         position[1],
//         position[2]
//       );

//       const position_margin_requirement_params = {
//         owner: position[0].address,
//         tickLower: position[1],
//         tickUpper: position[2],
//         isLM: false,
//         currentTick: currentTick,
//         termStartTimestampWad: termStartTimestampBN,
//         termEndTimestampWad: termEndTimestampBN,
//         liquidity: liquidity,
//         fixedTokenBalance: positionInfo[4],
//         variableTokenBalance: positionInfo[5],
//         variableFactorWad: variableFactorWad,
//         historicalApyWad: historicalApyWad,
//       };

//       const postitionMarginrRequirement =
//         await testMarginCalculator.getPositionMarginRequirementTest(
//           position_margin_requirement_params,
//           marginCalculatorParams
//         );

//       console.log(
//         "position margin requirement: ",
//         utils.formatEther(postitionMarginrRequirement)
//       );
//       console.log("");

//       return postitionMarginrRequirement;
//     }

//     async function printAPYboundsAndTraderMargin(trader: Wallet) {
//       await updateAPYbounds();

//       const traderInfo = await marginEngineTest.traders(trader.address);

//       const trader_margin_requirement_params = {
//         fixedTokenBalance: traderInfo.fixedTokenBalance,
//         variableTokenBalance: traderInfo.variableTokenBalance,
//         termStartTimestampWad: termStartTimestampBN,
//         termEndTimestampWad: termEndTimestampBN,
//         isLM: false,
//         historicalApyWad: historicalApyWad,
//       };

//       const traderMarginrRequirement =
//         await testMarginCalculator.getTraderMarginRequirement(
//           trader_margin_requirement_params,
//           marginCalculatorParams
//         );

//       console.log(
//         "trader margin requirement: ",
//         utils.formatEther(traderMarginrRequirement)
//       );

//       console.log("");

//       return traderMarginrRequirement;
//     }

//     async function printAmounts(
//       lowerTick: number,
//       upperTick: number,
//       liquidityBn: BigNumber
//     ) {
//       const ratioAtLowerTick = await testTickMath.getSqrtRatioAtTick(lowerTick);
//       const ratioAtUpperTick = await testTickMath.getSqrtRatioAtTick(upperTick);

//       const amount0 = await testSqrtPriceMath.getAmount0Delta(
//         ratioAtLowerTick,
//         ratioAtUpperTick,
//         liquidityBn,
//         true
//       );
//       const amount1 = await testSqrtPriceMath.getAmount1Delta(
//         ratioAtLowerTick,
//         ratioAtUpperTick,
//         liquidityBn,
//         true
//       );

//       console.log(
//         "PRICE at LOWER tick: ",
//         decodePriceSqrt(BigNumber.from(ratioAtLowerTick.toString()))
//       );
//       console.log(
//         "PRICE at UPPER tick: ",
//         decodePriceSqrt(BigNumber.from(ratioAtUpperTick.toString()))
//       );
//       console.log("           AMOUNT 0: ", amount0.toString());
//       console.log("           AMOUNT 1: ", amount1.toString());

//       return [
//         parseFloat(utils.formatEther(amount0)),
//         parseFloat(utils.formatEther(amount1)),
//       ];
//     }

//     // reserveNormalizedIncome format: x.yyyy
//     async function advanceAndUpdateApy(
//       time: BigNumber,
//       blockCount: number,
//       reserveNormalizedIncome: number
//     ) {
//       await advanceTimeAndBlock(time, blockCount);

//       console.log(
//         "reserveNormalizedIncome in 1e27",
//         reserveNormalizedIncome.toString().replace(".", "") + "0".repeat(23)
//       );
//       await aaveLendingPool.setReserveNormalizedIncome(
//         token.address,
//         Math.floor(reserveNormalizedIncome * 10000).toString() + "0".repeat(23)
//       );

//       await rateOracleTest.writeOracleEntry();

//       await printReserveNormalizedIncome();

//       await updateAPYbounds();
//     }

//     async function settlePositionsAndTraders(
//       positions: [Wallet, number, number][],
//       traders: Wallet[]
//     ) {
//       for (let i = 0; i < positions.length; i++) {
//         await marginEngineTest.settlePosition({
//           owner: positions[i][0].address,
//           tickLower: positions[i][1],
//           tickUpper: positions[i][2],
//           liquidityDelta: toBn("0"),
//         });
//       }

//       for (let i = 0; i < traders.length; i++) {
//         await marginEngineTest.settleTrader(traders[i].address);
//       }
//     }

//     function randomInt(min: number, max: number) {
//       return Math.floor(Math.random() * (max - min + 1)) + min;
//     }

//     it("full scenario 5", async () => {
//       const positions: [Wallet, number, number][] = [
//         [LPWallets[0], -TICK_SPACING, TICK_SPACING],
//         [LPWallets[1], -3 * TICK_SPACING, -TICK_SPACING],
//         [LPWallets[0], -3 * TICK_SPACING, TICK_SPACING],
//         [LPWallets[0], 0, TICK_SPACING],
//         [LPWallets[2], -3 * TICK_SPACING, TICK_SPACING],
//       ];

//       const liquidities = [0, 0, 0, 0, 0];

//       const traders = TWallets;

//       for (let i = 0; i < traders.length; i++) {
//         await updateTraderMargin(traders[i], toBn("10000"));
//       }

//       const length_of_series = 50;
//       const actions = [1, 2, 3];
//       await printAPYboundsAndTraderMargin(traders[0]);

//       for (let step = 0; step < length_of_series * 24; step++) {
//         // await advanceAndUpdateApy(consts.ONE_HOUR, 1, 1.010 + step * 0.00001);
//         await advanceAndUpdateApy(consts.ONE_HOUR, 1, 1.01);

//         const action = step < 5 ? 1 : actions[randomInt(0, actions.length - 1)];

//         console.log(
//           "----------------------------",
//           step,
//           "----------------------------"
//         );
//         console.log(
//           "----------------------------",
//           action,
//           "----------------------------"
//         );
//         console.log("");

//         await printPositionsAndTradersInfo(positions, traders, [0, 1, 2, 3, 4]);

//         if (action === 1) {
//           // position mint
//           const position_index = randomInt(0, positions.length - 1);
//           const liquidityDelta = randomInt(10000, 100000);
//           const liquidityDeltaBn = toBn(liquidityDelta.toString());

//           const positionTraderRequirement =
//             await printAPYboundsAndPositionMargin(
//               positions[position_index],
//               liquidityDeltaBn
//             );
//           await updatePositionMargin(
//             positions[position_index],
//             toBn("0"),
//             positionTraderRequirement.add(toBn("1000"))
//           );

//           await vammTest
//             .connect(positions[position_index][0])
//             .mint(
//               positions[position_index][0].address,
//               positions[position_index][1],
//               positions[position_index][2],
//               liquidityDeltaBn
//             );

//           liquidities[position_index] += liquidityDelta;
//         }

//         if (action === 2) {
//           // position burn
//           const position_index = randomInt(0, positions.length - 1);
//           const liquidityDelta = randomInt(0, liquidities[position_index]);
//           const liquidityDeltaBn = toBn(liquidityDelta.toString());

//           if (liquidityDelta <= 0) continue;

//           await vammTest
//             .connect(positions[position_index][0])
//             .burn(
//               positions[position_index][0].address,
//               positions[position_index][1],
//               positions[position_index][2],
//               liquidityDeltaBn
//             );

//           liquidities[position_index] -= liquidityDelta;
//         }

//         if (action === 3) {
//           // trader swap
//           const trader_index = randomInt(0, traders.length - 1);
//           const isFT = randomInt(0, 1) === 0;

//           currentTick = await vammTest.getCurrentTick();

//           let amount = 0;
//           if (isFT) {
//             let max_variable_amount = 0;
//             for (let i = 0; i < positions.length; i++) {
//               if (currentTick < positions[i][2]) {
//                 max_variable_amount += (
//                   await printAmounts(
//                     Math.min(currentTick, positions[i][1]),
//                     positions[i][2],
//                     toBn(liquidities[i].toString())
//                   )
//                 )[1];
//               }
//             }

//             console.log("variable amount: 0 ->", max_variable_amount);
//             if (max_variable_amount <= 0) continue;

//             amount = randomInt(1, Math.floor(max_variable_amount / 10));
//           } else {
//             let max_variable_amount = 0;
//             for (let i = 0; i < positions.length; i++) {
//               if (positions[i][1] < currentTick) {
//                 max_variable_amount += (
//                   await printAmounts(
//                     positions[i][1],
//                     Math.max(positions[i][2], currentTick),
//                     toBn(liquidities[i].toString())
//                   )
//                 )[1];
//               }
//             }

//             console.log("variable amount: ", -max_variable_amount, "-> 0");
//             if (max_variable_amount <= 0) continue;

//             amount = randomInt(-max_variable_amount, -1);
//           }

//           await vammTest.connect(traders[trader_index]).swap({
//             recipient: traders[trader_index].address,
//             isFT: isFT,
//             amountSpecified: toBn(amount.toString()),
//             sqrtPriceLimitX96: isFT
//               ? BigNumber.from(MAX_SQRT_RATIO.sub(1))
//               : BigNumber.from(MIN_SQRT_RATIO.add(1)),
//             isUnwind: false,
//             isTrader: true,
//             tickLower: 0,
//             tickUpper: 0,
//           });
//         }
//       }

//       await advanceTimeAndBlock(consts.ONE_DAY.mul(90 - length_of_series), 2); // advance 5 days to reach maturity

//       // settle positions and traders
//       await settlePositionsAndTraders(positions, traders);

//       console.log(
//         "----------------------------FINAL----------------------------"
//       );
//       await printPositionsAndTradersInfo(positions, traders, [0, 1]);
//     });
//   });
// });
