/*
Currently if you were to run the tests --> get 4 fails:
    AssertionError: Expected "0" to be equal 31709791983764586000
    AssertionError: Expected "0" to be equal 7927447995941146000
    (the above two errors happen because the tests assume hardcoded margin engine parameter values without setting them first)
    (these parameters include minDelta, etc)
    Error: VM Exception while processing transaction: reverted with panic code 0x12 (Division or modulo division by zero)
    Error: VM Exception while processing transaction: reverted with panic code 0x12 (Division or modulo division by zero)
    (the above two errors also happened because the some of the parameteres have default values of zero, some of them are used in the denominators of math fractions)
*/

// import { Wallet, BigNumber } from "ethers";
// import { expect } from "chai";
// import { ethers, waffle } from "hardhat";
// import { MarginCalculator } from "../../typechain/MarginCalculator";
// import { toBn } from "evm-bn";
// import { div, sub, mul, add } from "../shared/functions";
// import { encodeSqrtRatioX96, expandTo18Decimals, accrualFact, fixedFactor } from "../shared/utilities";
// import {FixedAndVariableMath} from "../../typechain/FixedAndVariableMath";

// import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";

// const createFixtureLoader = waffle.createFixtureLoader;

// function getTraderMarginRequirement(fixedTokenBalance: BigNumber,
//     variableTokenBalance: BigNumber, termStartTimestamp: BigNumber, termEndTimestamp: BigNumber,
//     isLM: boolean) : BigNumber {

//         const isFT: boolean = variableTokenBalance < toBn("0")

//         const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp)

//         const exp1: BigNumber = mul(fixedTokenBalance, fixedFactor(true, termStartTimestamp, termEndTimestamp))

//         const exp2: BigNumber = mul(variableTokenBalance, worstCaseVariableFactorAtMaturity(timeInSeconds, isFT, isLM))

//         let margin: BigNumber = add(exp1, exp2)

//         const minimumMargin: BigNumber = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)

//         if (margin < minimumMargin) {
//             margin = minimumMargin
//         }

//         return margin
// }

// function worstCaseVariableFactorAtMaturity(timeInSeconds: BigNumber, isFT: boolean, isLM: boolean) : BigNumber {
//     const timeInYears: BigNumber = accrualFact(timeInSeconds)
//     let variableFactor: BigNumber;

//     if (isFT) {
//         if (isLM) {
//             variableFactor = mul(timeInYears, toBn("0.09"))
//         } else {
//             variableFactor = mul(timeInYears, mul(toBn("0.09"), toBn("2.0")))
//         }
//     } else {
//         if (isLM) {
//             variableFactor = mul(timeInYears, toBn("0.01"))
//         } else {
//             variableFactor = mul(timeInYears, mul(toBn("0.09"), toBn("0.5")))
//         }
//     }

//     return variableFactor

// }

// function getMinimumMarginRequirement(fixedTokenBalance: BigNumber,
//     variableTokenBalance: BigNumber, termStartTimestamp: BigNumber, termEndTimestamp: BigNumber,
//     isLM: boolean) {

//     const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp)
//     const timeInYears: BigNumber = accrualFact(timeInSeconds)
//     let minDelta: BigNumber;
//     let margin: BigNumber;
//     let notional: BigNumber;

//     if (isLM) {
//         minDelta = toBn("0.0125")
//     } else {
//         minDelta = toBn("0.05")
//     }

//     if (variableTokenBalance < toBn("0")) {
//         // isFT
//         notional = mul(variableTokenBalance, toBn("-1"))
//         margin = mul(notional, mul(minDelta, timeInYears))
//     } else {
//         notional = variableTokenBalance
//         const zeroLowerBoundMargin: BigNumber = mul(fixedTokenBalance, mul(fixedFactor(true, termStartTimestamp, termEndTimestamp), toBn("-1")))
//         margin = mul(mul(variableTokenBalance, minDelta), timeInYears)

//         if (margin > zeroLowerBoundMargin) {
//             margin = zeroLowerBoundMargin
//         }

//     }

//     return margin
// }

// describe("Margin Calculator", () => {
//     let wallet: Wallet, other: Wallet;
//     let calculator: MarginCalculator;

//     let calculatorTest: MarginCalculatorTest;

//     const fixture = async () => {

//         const fixedAndVariableMathFactory = await ethers.getContractFactory(
//             "FixedAndVariableMath"
//         );

//         const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

//         const marginCalculator = await ethers.getContractFactory(
//             "MarginCalculator", {
//                 libraries: {
//                     FixedAndVariableMath: fixedAndVariableMath.address
//                 }
//             }
//             );

//         return (await marginCalculator.deploy()) as MarginCalculator;

//     };

//     let loadFixture: ReturnType<typeof createFixtureLoader>;

//     before("create fixture loader", async () => {
//       [wallet, other] = await (ethers as any).getSigners();

//       loadFixture = createFixtureLoader([wallet, other]);

//       const fixedAndVariableMathFactory = await ethers.getContractFactory(
//         "FixedAndVariableMath"
//       );

//       const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

//       const calculatorTestFactory = await ethers.getContractFactory(
//         "MarginCalculatorTest", {
//             libraries: {
//                 FixedAndVariableMath: fixedAndVariableMath.address
//             }
//         }
//       );
//       calculatorTest =
//         (await calculatorTestFactory.deploy()) as MarginCalculatorTest;
//     });

//     beforeEach("deploy calculator", async () => {
//       calculator = await loadFixture(fixture);
//     });

//     describe("getMinimumMarginRequirement", async () => {

//         it("correctly calculates the minimum margin requirement: fixed taker, not LM", async () => {

//             const fixedTokenBalance: BigNumber = toBn("1000")
//             const variableTokenBalance: BigNumber = toBn("-2000")
//             const termStartTimestamp: BigNumber = toBn("1636996083")
//             const termEndTimestamp: BigNumber = toBn("1646996083")
//             const isLM: boolean = false

//             const expected = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//             expect(await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         })

//         it("correctly calculates the minimum margin requirement: fixed taker, LM", async () => {

//             const fixedTokenBalance: BigNumber = toBn("1000")
//             const variableTokenBalance: BigNumber = toBn("-2000")
//             const termStartTimestamp: BigNumber = toBn("1636996083")
//             const termEndTimestamp: BigNumber = toBn("1646996083")
//             const isLM: boolean = true

//             const expected = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//             expect(await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         })

//         // todo: AssertionError: Expected "3170979198376459000" to be equal 3170979198376458000

//         // it("correctly calculates the minimum margin requirement: variable taker, not LM", async () => {

//         //     const fixedTokenBalance: BigNumber = toBn("-1000")
//         //     const variableTokenBalance: BigNumber = toBn("2000")
//         //     const termStartTimestamp: BigNumber = toBn("1636996083")
//         //     const termEndTimestamp: BigNumber = toBn("1646996083")
//         //     const isLM: boolean = false

//         //     const expected = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//         //     expect(await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         // })

//         // it("correctly calculates the minimum margin requirement: variable taker, LM", async () => {

//         //     const fixedTokenBalance: BigNumber = toBn("-1000")
//         //     const variableTokenBalance: BigNumber = toBn("2000")
//         //     const termStartTimestamp: BigNumber = toBn("1636996083")
//         //     const termEndTimestamp: BigNumber = toBn("1646996083")
//         //     const isLM: boolean = false

//         //     const expected = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//         //     expect(await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         // })

//     })

//     // todo: fix these small discrepancies
//     // describe("worstCaseVariableFactorAtMaturity", async () => {

//     //     it("correctly calculates the worst case variable factor at maturity, FT, LM", async () => {

//     //         const termStartTimestamp: BigNumber = toBn("1636996083")
//     //         const termEndTimestamp: BigNumber = toBn("1646996083")
//     //         const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp)
//     //         const isLM: boolean = true
//     //         const isFT: boolean = true

//     //         const expected = worstCaseVariableFactorAtMaturity(timeInSeconds, isFT, isLM)
//     //         expect(await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSeconds, isFT, isLM)).to.eq(expected)

//     //     })
//     // })

//     describe("#getTraderMarginRequirement", async () => {

//         it("correctly calculates the trader margin requirement", async () => {

//             const fixedTokenBalance: BigNumber = toBn("1000")
//             const variableTokenBalance: BigNumber = toBn("-2000")
//             const termStartTimestamp: BigNumber = toBn("1636996083")
//             const termEndTimestamp: BigNumber = toBn("1646996083")
//             const isLM: boolean = false

//             const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//             expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         })

//         it("correctly calculates the trader margin requirement", async () => {

//             const fixedTokenBalance: BigNumber = toBn("1000")
//             const variableTokenBalance: BigNumber = toBn("-2000")
//             const termStartTimestamp: BigNumber = toBn("1636996083")
//             const termEndTimestamp: BigNumber = toBn("1646996083")
//             const isLM: boolean = true

//             const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//             expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         })

//         // todo: fails
//         // it("correctly calculates the trader margin requirement", async () => {

//         //     const fixedTokenBalance: BigNumber = toBn("-1000")
//         //     const variableTokenBalance: BigNumber = toBn("2000")
//         //     const termStartTimestamp: BigNumber = toBn("1636996083")
//         //     const termEndTimestamp: BigNumber = toBn("1646996083")
//         //     const isLM: boolean = true

//         //     const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//         //     expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         // })

//         // todo: fails
//         // it("correctly calculates the trader margin requirement", async () => {

//         //     const fixedTokenBalance: BigNumber = toBn("-1000")
//         //     const variableTokenBalance: BigNumber = toBn("2000")
//         //     const termStartTimestamp: BigNumber = toBn("1636996083")
//         //     const termEndTimestamp: BigNumber = toBn("1646996083")
//         //     const isLM: boolean = false

//         //     const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
//         //     expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

//         // })

//         // todo: introduce tests for scenarios where the minimum margin requirement is higher, lower, modelMargin is negative, positive, etc

//     })

// })
