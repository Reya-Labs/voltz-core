// to fix following refactoring
// import { BigNumber, Wallet, Contract } from "ethers";
// import { ethers, waffle } from "hardhat";
// import { expect } from "chai";
// // import { accrualFact } from "../../shared/utilities";
// import { toBn } from "evm-bn";
// // import { div, sub, mul, add, pow } from "../../shared/functions";
// import { div, sub, add, pow } from "../../shared/functions";
// import { TestRateOracle } from "../../../typechain/TestRateOracle";
// import {
//   rateOracleFixture,
//   timeFixture,
//   fixedAndVariableMathFixture,
//   mockERC20Fixture,
//   mockAaveLendingPoolFixture,
//   metaFixture,
// } from "../../shared/fixtures";
// import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
// import { Factory } from "../../../typechain";

// const { provider } = waffle;

// function computeApyFromRate(rateFromTo: BigNumber, timeInYears: BigNumber) {
//   const exponent: BigNumber = div(toBn("1.0"), timeInYears);
//   const apyPlusOne: BigNumber = pow(add(toBn("1.0"), rateFromTo), exponent);
//   const apy: BigNumber = sub(apyPlusOne, toBn("1.0"));
//   return apy;
// }

// // function interpolateRateValue(
// //   beforeOrAtRateValue: BigNumber,
// //   apyFromBeforeOrAtToAtOrAfter: BigNumber,
// //   timeDeltaBeforeOrAtToQueriedTime: BigNumber
// // ) {
// //   const timeInYears = accrualFact(timeDeltaBeforeOrAtToQueriedTime);
// //   const exp1 = sub(
// //     pow(add(toBn("1.0"), apyFromBeforeOrAtToAtOrAfter), timeInYears),
// //     toBn("1.0")
// //   );

// //   const rateValue = mul(beforeOrAtRateValue, exp1);

// //   return rateValue;
// // }

// describe("Aave Rate Oracle", () => {
//   let wallet: Wallet, other: Wallet;
//   let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
//   let factory: Factory;

//   before("create fixture loader", async () => {
//     [wallet, other] = await (ethers as any).getSigners();
//     loadFixture = waffle.createFixtureLoader([wallet, other]);
//     ({ factory } = await loadFixture(metaFixture));
//   });

//   const oracleFixture = async () => {
//     const { time } = await timeFixture();
//     const { fixedAndVariableMath } = await fixedAndVariableMathFixture(
//       time.address
//     );
//     const { token } = await mockERC20Fixture();
//     const { aaveLendingPool } = await mockAaveLendingPoolFixture();

//     console.log(
//       "Test TS: Aave lending pool address is: ",
//       aaveLendingPool.address
//     );
//     await aaveLendingPool.setReserveNormalizedIncome(
//       token.address,
//       toBn("1.0")
//     );
//     console.log(
//       "Test TS: Aave normalized income is: ",
//       await aaveLendingPool.getReserveNormalizedIncome(token.address)
//     );
//     const { testRateOracle } = await rateOracleFixture(
//       fixedAndVariableMath.address,
//       time.address,
//       token.address,
//       aaveLendingPool.address,
//       factory.address
//     );

//     await testRateOracle.setMinSecondsSinceLastUpdate(toBn("7200")); // two hours
//     await testRateOracle.setSecondsAgo("86400"); // one day

//     return testRateOracle;
//   };

//   const initializedOracleFixture = async () => {
//     const testRateOracle = await oracleFixture();
//     await testRateOracle.initializeTestRateOracle({
//       tick: 0,
//       liquidity: 0,
//     });

//     return testRateOracle;
//   };

//   describe("#initialize", () => {
//     let testRateOracle: TestRateOracle;
//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);
//     });

//     // it("aave lending pool set correctly", async () => {
//     //   const normalizedIncome =
//     //     await testRateOracle.testGetReserveNormalizedIncome();
//     //   expect(normalizedIncome).to.eq(toBn("1.0"));
//     // });

//     it("rateIndex, rateCardinality, rateCardinalityNext correctly initialized", async () => {
//       const [rateIndex, rateCardinality, rateCardinalityNext] =
//         await testRateOracle.getOracleVars();
//       expect(rateIndex).to.eq(0);
//       expect(rateCardinality).to.eq(1);
//       expect(rateCardinalityNext).to.eq(1);
//     });
//   });

//   describe("#grow", () => {
//     let testRateOracle: TestRateOracle;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);
//       // await testRateOracle.initializeTestRateOracle({
//       //   tick: 1,
//       //   liquidity: 1
//       // });
//     });

//     it("increases the cardinality next for the first call", async () => {
//       await testRateOracle.testGrow(5);
//       const [rateIndex, rateCardinality, rateCardinalityNext] =
//         await testRateOracle.getOracleVars();
//       expect(rateIndex).to.eq(0);
//       expect(rateCardinality).to.eq(1);
//       expect(rateCardinalityNext).to.eq(5);
//     });

//     it("is no op if oracle is already gte that size", async () => {
//       await testRateOracle.testGrow(5);
//       await testRateOracle.testGrow(3);
//       const [rateIndex, rateCardinality, rateCardinalityNext] =
//         await testRateOracle.getOracleVars();
//       expect(rateIndex).to.eq(0);
//       expect(rateCardinality).to.eq(1);
//       expect(rateCardinalityNext).to.eq(5);
//     });
//   });

//   describe("#write", () => {
//     let testRateOracle: TestRateOracle;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);
//     });

//     it("single element array gets overwritten", async () => {
//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       const currentTimestamp = await getCurrentTimestamp(provider);
//       await testRateOracle.update();
//       const [rateIndex] = await testRateOracle.getOracleVars();
//       expect(rateIndex).to.eq(0);
//       const [rateTimestamp, rateValue] = await testRateOracle.getRate(0);
//       console.log(currentTimestamp);
//       console.log(rateTimestamp);
//       expect(rateValue).to.eq(toBn("1.0"));
//       expect(rateTimestamp).to.eq(toBn((currentTimestamp + 1).toString()));
//     });

//     it("grows cardinality if writing past", async () => {
//       await testRateOracle.testGrow(2);
//       await testRateOracle.testGrow(4);
//       let [rateIndex, rateCardinality] = await testRateOracle.getOracleVars();
//       expect(rateCardinality).to.eq(1);
//       console.log(await getCurrentTimestamp(provider));
//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       console.log(await getCurrentTimestamp(provider));
//       await testRateOracle.update();
//       [rateIndex, rateCardinality] = await testRateOracle.getOracleVars();
//       expect(rateCardinality).to.eq(4);
//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       const currentTimestamp = await getCurrentTimestamp(provider);
//       await testRateOracle.update();
//       [rateIndex, rateCardinality] = await testRateOracle.getOracleVars();
//       expect(rateIndex).to.eq(2);
//       expect(rateCardinality).to.eq(4);
//       const [rateTimestamp, rateValue] = await testRateOracle.getRate(2);
//       expect(rateValue).to.eq(toBn("1.0"));
//       expect(rateTimestamp).to.eq(toBn((currentTimestamp + 1).toString()));
//     });
//   });

//   describe("#observe", async () => {
//     let testRateOracle: TestRateOracle;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(oracleFixture);
//     });

//     it("fails before initialize", async () => {
//       const currentTimestamp = await getCurrentTimestamp(provider);
//       const currentTimestampBN = toBn(currentTimestamp.toString());
//       await expect(testRateOracle.testObserveSingle(currentTimestampBN)).to.be
//         .reverted;
//     });
//   });

//   describe("#getRateFromTo", async () => {
//     let testRateOracle: TestRateOracle;
//     let aaveLendingPoolContract: Contract;
//     let underlyingTokenAddress: string;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);
//       const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
//       underlyingTokenAddress = await testRateOracle.underlying();
//       const aaveLendingPoolAbi = [
//         "function getReserveNormalizedIncome(address _underlyingAsset) public override view returns (uint256)",
//         "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
//       ];
//       aaveLendingPoolContract = new Contract(
//         aaveLendingPoolAddress,
//         aaveLendingPoolAbi,
//         provider
//       ).connect(wallet);
//     });

//     // it("correctly sets aave lending pool normalized income", async () => {
//     //   await aaveLendingPoolContract.setReserveNormalizedIncome(
//     //     underlyingTokenAddress,
//     //     toBn("1.1")
//     //   );
//     //   const normalizedIncome =
//     //     await testRateOracle.testGetReserveNormalizedIncome();
//     //   expect(normalizedIncome).to.eq(toBn("1.1"));
//     // });

//     it("correctly calculates rate from one timestamp to the next", async () => {
//       await testRateOracle.testGrow(4);

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       // set new liquidity index value
//       await aaveLendingPoolContract.setReserveNormalizedIncome(
//         underlyingTokenAddress,
//         toBn("1.1")
//       );
//       const rateToTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();

//       await testRateOracle.testGetRateFromTo(
//         toBn(rateFromTimestamp.toString()),
//         toBn(rateToTimestamp.toString())
//       );
//       const rateFromTo = await testRateOracle.latestRateFromTo();

//       const expectedRateFromTo = toBn("0.1");

//       expect(rateFromTo).to.eq(expectedRateFromTo);
//     });
//   });

//   // describe("#interpolateRateValue", async () => {
//   //   let testRateOracle: TestRateOracle;

//   //   beforeEach("deploy and initialize test oracle", async () => {
//   //     testRateOracle = await loadFixture(initializedOracleFixture);
//   //   });

//   //   // Get back to this
//   //   // it("correctly interpolates the rate value", async () => {
//   //   //   const realizedInterpolatedRateValue =
//   //   //     await testRateOracle.testInterpolateRateValue(
//   //   //       toBn("1.0"),
//   //   //       toBn("0.1"),
//   //   //       toBn("604800")
//   //   //     ); // one week
//   //   //   const expectedRateValue = interpolateRateValue(
//   //   //     toBn("1.0"),
//   //   //     toBn("0.1"),
//   //   //     toBn("604800")
//   //   //   );
//   //   //   expect(realizedInterpolatedRateValue).to.eq(expectedRateValue);
//   //   // });
//   // });

//   describe("#binarySearch", async () => {
//     let testRateOracle: TestRateOracle;
//     let aaveLendingPoolContract: Contract;
//     let underlyingTokenAddress: string;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);

//       const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
//       underlyingTokenAddress = await testRateOracle.underlying();
//       const aaveLendingPoolAbi = [
//         "function getReserveNormalizedIncome(address _underlyingAsset) public override view returns (uint256)",
//         "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
//       ];
//       aaveLendingPoolContract = new Contract(
//         aaveLendingPoolAddress,
//         aaveLendingPoolAbi,
//         provider
//       ).connect(wallet);
//     });

//     it("binary search works as expected", async () => {
//       await testRateOracle.testGrow(4);

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       const beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       // set new liquidity index value
//       await aaveLendingPoolContract.setReserveNormalizedIncome(
//         underlyingTokenAddress,
//         toBn("1.1")
//       );
//       const afterOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();

//       const targetTimestamp = div(
//         add(
//           toBn(beforeOrAtTimestamp.toString()),
//           toBn(afterOrAtTimestamp.toString())
//         ),
//         toBn("2.0")
//       );

//       const [beforeOrAtRateValue, afterOrAtRateValue] =
//         await testRateOracle.testBinarySearch(targetTimestamp);

//       expect(beforeOrAtRateValue).to.eq(toBn("1.0"));
//       expect(afterOrAtRateValue).to.eq(toBn("1.1"));
//     });

//     // other scenarios
//   });

//   describe("#getSurroundingRates", async () => {
//     let testRateOracle: TestRateOracle;
//     let aaveLendingPoolContract: Contract;
//     let underlyingTokenAddress: string;

//     let beforeOrAtTimestamp: number;
//     let atOrAfterTimestamp: number;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);

//       const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
//       underlyingTokenAddress = await testRateOracle.underlying();
//       const aaveLendingPoolAbi = [
//         "function getReserveNormalizedIncome(address _underlyingAsset) public override view returns (uint256)",
//         "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
//       ];
//       aaveLendingPoolContract = new Contract(
//         aaveLendingPoolAddress,
//         aaveLendingPoolAbi,
//         provider
//       ).connect(wallet);

//       await testRateOracle.testGrow(6);

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       // set new liquidity index value
//       await aaveLendingPoolContract.setReserveNormalizedIncome(
//         underlyingTokenAddress,
//         toBn("1.1")
//       );
//       atOrAfterTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();
//     });

//     it("target is beforeOrAt", async () => {
//       await testRateOracle.testGetSurroundingRates(
//         toBn(beforeOrAtTimestamp.toString())
//       );

//       const realizedBeforeOrAtRateValue =
//         await testRateOracle.latestBeforeOrAtRateValue();
//       const realizedAtOrAfterValue =
//         await testRateOracle.latestAfterOrAtRateValue();

//       console.log(realizedBeforeOrAtRateValue);
//       console.log(realizedAtOrAfterValue);

//       expect(realizedBeforeOrAtRateValue).to.eq(toBn("1.0"));
//       expect(realizedAtOrAfterValue).to.eq(toBn("1.1"));
//     });

//     it("target is atOrAfter", async () => {
//       await testRateOracle.testGetSurroundingRates(
//         toBn(atOrAfterTimestamp.toString())
//       );

//       const realizedBeforeOrAtRateValue =
//         await testRateOracle.latestBeforeOrAtRateValue();
//       const realizedAtOrAfterValue =
//         await testRateOracle.latestAfterOrAtRateValue();

//       console.log(realizedBeforeOrAtRateValue);
//       console.log(realizedAtOrAfterValue);

//       expect(realizedBeforeOrAtRateValue).to.eq(toBn("1.1"));
//       expect(realizedAtOrAfterValue).to.eq(0);
//     });

//     it("target is in the middle", async () => {
//       const targetTimestamp = div(
//         add(
//           toBn(beforeOrAtTimestamp.toString()),
//           toBn(atOrAfterTimestamp.toString())
//         ),
//         toBn("2.0")
//       );

//       await testRateOracle.testGetSurroundingRates(targetTimestamp);

//       const realizedBeforeOrAtRateValue =
//         await testRateOracle.latestBeforeOrAtRateValue();
//       const realizedAtOrAfterValue =
//         await testRateOracle.latestAfterOrAtRateValue();

//       // does binary search

//       expect(realizedBeforeOrAtRateValue).to.eq(toBn("1.0"));
//       expect(realizedAtOrAfterValue).to.eq(toBn("1.1"));
//     });

//     it("fails if target is too old", async () => {
//       const targetTimestamp = toBn((beforeOrAtTimestamp - 604800).toString()); // going back one week

//       await expect(testRateOracle.testGetSurroundingRates(targetTimestamp)).to
//         .be.reverted;
//     });
//   });

//   describe("#computeApyFromRate", async () => {
//     let testRateOracle: TestRateOracle;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);
//     });

//     it("correctly computes apy", async () => {
//       const realizedApy = await testRateOracle.testComputeApyFromRate(
//         toBn("0.1"),
//         toBn("0.5")
//       );
//       const expectedApy = computeApyFromRate(toBn("0.1"), toBn("0.5"));
//       expect(realizedApy).to.be.closeTo(expectedApy, 100);
//     });
//   });

//   describe("#variableFactor", async () => {
//     let testRateOracle: TestRateOracle;
//     let aaveLendingPoolContract: Contract;
//     let underlyingTokenAddress: string;

//     let firstTimestamp: number;
//     let secondTimestamp: number;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);

//       const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
//       underlyingTokenAddress = await testRateOracle.underlying();
//       const aaveLendingPoolAbi = [
//         "function getReserveNormalizedIncome(address _underlyingAsset) public override view returns (uint256)",
//         "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
//       ];
//       aaveLendingPoolContract = new Contract(
//         aaveLendingPoolAddress,
//         aaveLendingPoolAbi,
//         provider
//       ).connect(wallet);

//       await testRateOracle.testGrow(10);

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       firstTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       // set new liquidity index value
//       await aaveLendingPoolContract.setReserveNormalizedIncome(
//         underlyingTokenAddress,
//         toBn("1.1")
//       );
//       secondTimestamp = (await getCurrentTimestamp(provider)) + 1;
//       await testRateOracle.update();
//     });

//     it("calculate variable factor at maturity", async () => {
//       const termStartTimestampBN = toBn(firstTimestamp.toString());
//       const termEndTimestampBN = toBn(secondTimestamp.toString());
//       await testRateOracle.testVariableFactor(
//         termStartTimestampBN,
//         termEndTimestampBN
//       );
//       const expectedVariableFactor = toBn("0.1");
//       const realizedVariableFactor =
//         await testRateOracle.latestVariableFactor();
//       expect(realizedVariableFactor).to.eq(expectedVariableFactor);
//     });

//     it("calculate variable factor after maturity", async () => {
//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       const termStartTimestampBN = toBn(firstTimestamp.toString());
//       const termEndTimestampBN = toBn(secondTimestamp.toString());
//       await testRateOracle.testVariableFactor(
//         termStartTimestampBN,
//         termEndTimestampBN
//       );
//       const expectedVariableFactor = toBn("0.1");
//       const realizedVariableFactor =
//         await testRateOracle.latestVariableFactor();
//       expect(realizedVariableFactor).to.eq(expectedVariableFactor);
//     });

//     it("calculates variable factor before maturity", async () => {
//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       await aaveLendingPoolContract.setReserveNormalizedIncome(
//         underlyingTokenAddress,
//         toBn("1.2")
//       );

//       const termStartTimestampBN = toBn(firstTimestamp.toString());
//       const termEndTimestampBN = toBn((secondTimestamp + 604800).toString());

//       await testRateOracle.testVariableFactor(
//         termStartTimestampBN,
//         termEndTimestampBN
//       );

//       const expectedVariableFactor = toBn("0.2");
//       const realizedVariableFactor =
//         await testRateOracle.latestVariableFactor();
//       expect(realizedVariableFactor).to.eq(expectedVariableFactor);
//     });

//     it("reverts if termStartTimestamp is too old", async () => {
//       const termStartTimestampBN = toBn((firstTimestamp - 1).toString());
//       const termEndTimestampBN = toBn((secondTimestamp + 604800).toString());

//       await expect(
//         testRateOracle.testVariableFactor(
//           termStartTimestampBN,
//           termEndTimestampBN
//         )
//       ).to.be.reverted;
//     });
//   });

//   describe("#getHistoricalApy", async () => {
//     let testRateOracle: TestRateOracle;
//     let aaveLendingPoolContract: Contract;
//     let underlyingTokenAddress: string;

//     beforeEach("deploy and initialize test oracle", async () => {
//       testRateOracle = await loadFixture(initializedOracleFixture);

//       const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
//       underlyingTokenAddress = await testRateOracle.underlying();
//       const aaveLendingPoolAbi = [
//         "function getReserveNormalizedIncome(address _underlyingAsset) public override view returns (uint256)",
//         "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
//       ];
//       aaveLendingPoolContract = new Contract(
//         aaveLendingPoolAddress,
//         aaveLendingPoolAbi,
//         provider
//       ).connect(wallet);

//       await testRateOracle.testGrow(10);

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       await testRateOracle.update();

//       await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
//       // set new liquidity index value
//       await aaveLendingPoolContract.setReserveNormalizedIncome(
//         underlyingTokenAddress,
//         toBn("1.1")
//       );
//       await testRateOracle.update();
//     });

//     // Error: VM Exception while processing transaction: reverted with reason string '50' (needs to be fixed)
//     // it("correctly computes historical apy", async () => {
//     //   // await testRateOracle.setSecondsAgo("86400"); // one day
//     //   await testRateOracle.testGetHistoricalApy();
//     //   const realizedHistoricalApy = await testRateOracle.latestHistoricalApy();
//     //   expect(realizedHistoricalApy).to.eq(0);

//     // })
//   });
// });
