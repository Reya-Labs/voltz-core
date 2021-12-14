import { Wallet, BigNumber } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MarginCalculator } from "../../typechain/MarginCalculator";
import { toBn } from "evm-bn";
import { div, sub, mul, add, sqrt, floor} from "../shared/functions";
import { encodeSqrtRatioX96, expandTo18Decimals, accrualFact, fixedFactor } from "../shared/utilities";
import {FixedAndVariableMath} from "../../typechain/FixedAndVariableMath";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import {getCurrentTimestamp, advanceTime} from "../helpers/time";

import {consts} from "../helpers/constants";
// import { floor } from "prb-math";
// import { sqrt } from "../shared/sqrt";

const createFixtureLoader = waffle.createFixtureLoader;

// below numbers are arbitrary for now, move into another file
const APY_UPPER_MULTIPLIER = toBn("1.5"); // todo: use Neil's toBn implementation
const APY_LOWER_MULTIPLIER = toBn("0.7");
const MIN_DELTA_LM = toBn("0.03");
const MIN_DELTA_IM = toBn("0.06");
const MAX_LEVERAGE = toBn("10.0");
const SIGMA_SQUARED = toBn("0.01");
const ALPHA = toBn("0.04");
const BETA = toBn("1.0");
const XI_UPPER = toBn("2.0");
const XI_LOWER = toBn("1.5");
const RATE_ORACLE_ID = ethers.utils.formatBytes32String("AaveV2");
const DEFAULT_TIME_FACTOR = toBn("0.5");
const { provider } = waffle;

function getTraderMarginRequirement(fixedTokenBalance: BigNumber,
    variableTokenBalance: BigNumber, termStartTimestamp: BigNumber, termEndTimestamp: BigNumber,
    isLM: boolean, rateOracleId: string, twapApy: BigNumber, blockTimestampScaled: BigNumber) {
    
    const isFT: boolean = variableTokenBalance < toBn("0");

    const timeInSecondsFromStartToMaturity: BigNumber = sub(termEndTimestamp, termStartTimestamp);
    const timeInSecondsFromNowToMaturity: BigNumber = sub(termEndTimestamp, blockTimestampScaled);
    const exp1 = mul(fixedTokenBalance, fixedFactor(true, termStartTimestamp, termEndTimestamp));
    const exp2 = mul(variableTokenBalance, worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, rateOracleId, twapApy));
    const modelMargin = add(exp1, exp2);
    const minimumMargin = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM, twapApy);

    var margin: BigNumber;
    
    if ((sub(modelMargin, minimumMargin) < toBn("0"))) {
        margin = minimumMargin;
    } else {
        margin = modelMargin;
    }

    return margin;
}


function worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity: BigNumber, timeInSecondsFromNowToMaturity: BigNumber, isFT: boolean, isLM: boolean, rateOracleId: string, twapApy: BigNumber) : BigNumber {
    const timeInYearsFromStartUntilMaturity: BigNumber = accrualFact(timeInSecondsFromStartToMaturity);
    let variableFactor: BigNumber;
    let apyBound: BigNumber;

    if (isFT) {
        apyBound = computeApyBound(rateOracleId, timeInSecondsFromNowToMaturity, twapApy, true);
        if (isLM) {
            variableFactor = mul(timeInYearsFromStartUntilMaturity, apyBound);
        } else {
            variableFactor = mul(timeInYearsFromStartUntilMaturity, mul(apyBound, APY_UPPER_MULTIPLIER))
        }
    } else {
        apyBound = computeApyBound(rateOracleId, timeInSecondsFromNowToMaturity, twapApy, false);
        if (isLM) {
            variableFactor = mul(timeInYearsFromStartUntilMaturity, apyBound);
        } else {
            variableFactor = mul(timeInYearsFromStartUntilMaturity, mul(apyBound, APY_LOWER_MULTIPLIER));
        }
    }

    return variableFactor

}


// const expected = computeApyBound(RATE_ORACLE_ID, timeInSeconds, twapApy, isUpper);

function computeApyBound(rateOracleId: string, timeInSeconds: BigNumber, twapApy: BigNumber, isUpper: boolean) {
    const timeFactor: BigNumber = DEFAULT_TIME_FACTOR;
    const oneMinusTimeFactor: BigNumber = sub(toBn("1"), timeFactor);
    const k: BigNumber = div(ALPHA, SIGMA_SQUARED);
    const zeta: BigNumber = div(mul(SIGMA_SQUARED, oneMinusTimeFactor), BETA);
    const lambdaNum: BigNumber = mul(mul(BETA, timeFactor), twapApy);
    const lambdaDen: BigNumber = mul(BETA, timeFactor);
    const lambda: BigNumber = div(lambdaNum, lambdaDen);
    const criticalValueMultiplier: BigNumber = mul(add(mul(toBn("2"), lambda), k), toBn("2"));
    const criticalValueMultiplierSqrt: BigNumber = sqrt(criticalValueMultiplier)

    let criticalValue: BigNumber;
    if (isUpper) {
        criticalValue = mul(XI_UPPER, criticalValueMultiplierSqrt);
    } else {
        criticalValue = mul(XI_LOWER, criticalValueMultiplierSqrt)
    }

    var apyBound: BigNumber = mul(zeta, add( add(k, lambda), criticalValue));

    if (apyBound < toBn("0")) {
        apyBound = toBn("0");
    }

    return apyBound;

}   


function getMinimumMarginRequirement(fixedTokenBalance: BigNumber,
    variableTokenBalance: BigNumber, termStartTimestamp: BigNumber, termEndTimestamp: BigNumber,
    isLM: boolean, twapApy: BigNumber) {

    // twapApy is not necessary for this calculation

    const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp)
    const timeInYears: BigNumber = accrualFact(timeInSeconds)
    let minDelta: BigNumber;
    var margin: BigNumber;
    let notional: BigNumber;


    if (isLM) {
        minDelta = MIN_DELTA_LM
    } else {
        minDelta = MIN_DELTA_IM
    }

    if (variableTokenBalance < toBn("0")) {
        // isFT
        // variable token balance must be negative
        notional = mul(variableTokenBalance, toBn("-1"));
        margin = mul(notional, mul(minDelta, timeInYears));
    } else {
        notional = variableTokenBalance
        const zeroLowerBoundMargin: BigNumber = mul(fixedTokenBalance, mul(fixedFactor(true, termStartTimestamp, termEndTimestamp), toBn("-1")))
        console.log(`Test: Zero Lower Bound Margin is${ zeroLowerBoundMargin }`);
        margin = mul(mul(variableTokenBalance, minDelta), timeInYears)

        if (sub(margin, zeroLowerBoundMargin) > toBn("0") ) {
            margin = zeroLowerBoundMargin;
        }
    }

    console.log(`Test: Notional is ${ notional }`);
    console.log(`Test: Margin is ${ margin }`);
    console.log(`Test: Fixed Factor is${ fixedFactor(true, termStartTimestamp, termEndTimestamp) }`);

    return margin
}

describe("Margin Calculator", () => {
    let wallet: Wallet, other: Wallet;
    let calculatorTest: MarginCalculatorTest;

    const fixture = async () => {

        const timeFactory = await ethers.getContractFactory("Time");

        const timeLibrary = await timeFactory.deploy();
        
        const fixedAndVariableMathFactory = await ethers.getContractFactory(
            "FixedAndVariableMath", {
                libraries: {
                    Time: timeLibrary.address
                }
            }
        );

        const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

        const marginCalculator = await ethers.getContractFactory(
            "MarginCalculatorTest", {
                libraries: {
                    FixedAndVariableMath: fixedAndVariableMath.address,
                    Time: timeLibrary.address
                }
            }
        );

        return (await marginCalculator.deploy()) as MarginCalculatorTest;

    };

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    before("create fixture loader", async () => {
      [wallet, other] = await (ethers as any).getSigners();

      loadFixture = createFixtureLoader([wallet, other]);
    });

    beforeEach("deploy calculator", async () => {
        calculatorTest = await loadFixture(fixture);
    });

    describe("Margin Calculator Parameters", async () => {

        it("correctly sets the Margin Calculator Parameters", async () => {
            await calculatorTest.setMarginCalculatorParametersTest(
                RATE_ORACLE_ID, 
                APY_UPPER_MULTIPLIER, 
                APY_LOWER_MULTIPLIER,
                MIN_DELTA_LM,
                MIN_DELTA_IM,
                MAX_LEVERAGE, 
                SIGMA_SQUARED, 
                ALPHA,
                BETA, 
                XI_UPPER, 
                XI_LOWER 
            );        
            
            const marginCalculatorParameters = await calculatorTest.getMarginCalculatorParametersTest(RATE_ORACLE_ID);
            expect(marginCalculatorParameters[0]).to.eq(APY_UPPER_MULTIPLIER);
            expect(marginCalculatorParameters[1]).to.eq(APY_LOWER_MULTIPLIER);
            expect(marginCalculatorParameters[2]).to.eq(MIN_DELTA_LM);
            expect(marginCalculatorParameters[3]).to.eq(MIN_DELTA_IM);
            expect(marginCalculatorParameters[4]).to.eq(MAX_LEVERAGE);
            expect(marginCalculatorParameters[5]).to.eq(SIGMA_SQUARED);
            expect(marginCalculatorParameters[6]).to.eq(ALPHA);
            expect(marginCalculatorParameters[7]).to.eq(BETA);
            expect(marginCalculatorParameters[8]).to.eq(XI_UPPER);
            expect(marginCalculatorParameters[9]).to.eq(XI_LOWER);
            // expect(await calculatorTest.accrualFact(x)).to.eq(expected);
        });

        it("correctly sets the time factors", async () => {

            const timeInDays: BigNumber = toBn("3");

            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDays, DEFAULT_TIME_FACTOR);

            const timeFactorRealised = await calculatorTest.getTimeFactorTest(RATE_ORACLE_ID, timeInDays);

            expect(timeFactorRealised).to.eq(DEFAULT_TIME_FACTOR);
        })
    });

    describe("getMinimumMarginRequirement (zeroLowerBound boolean is true)", async () => {

        beforeEach("deploy calculator", async () => {
            calculatorTest = await loadFixture(fixture);
            await calculatorTest.setMarginCalculatorParametersTest(
                RATE_ORACLE_ID, 
                APY_UPPER_MULTIPLIER, 
                APY_LOWER_MULTIPLIER,
                MIN_DELTA_LM,
                MIN_DELTA_IM,
                MAX_LEVERAGE, 
                SIGMA_SQUARED, 
                ALPHA,
                BETA, 
                XI_UPPER, 
                XI_LOWER 
            );
        });

        // passes
        it("correctly calculates the minimum margin requirement: fixed taker, LM, FT", async () => {

            const fixedTokenBalance: BigNumber = toBn("1000");
            const variableTokenBalance: BigNumber = toBn("-3000");
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

            const isLM: boolean = true;
            const twapApy: BigNumber = toBn("0.02");

            const expectedMinimumMarginRequirement: BigNumber = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, twapApy); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
            const realisedMinimumMarginRequirement: BigNumber = await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy);
            // expect(realisedMinimumMarginRequirement).to.eq(expectedMinimumMarginRequirement);
            expect(realisedMinimumMarginRequirement).to.be.closeTo(expectedMinimumMarginRequirement, 10000);

        })

        // passes
        it("correctly calculates the minimum margin requirement: fixed taker, LM, VT", async () => {

            const fixedTokenBalance: BigNumber = toBn("-3000");
            const variableTokenBalance: BigNumber = toBn("1000");
            
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

            const isLM: boolean = true;
            const twapApy: BigNumber = toBn("0.02");

            const expectedMinimumMarginRequirement: BigNumber = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, twapApy); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
            const realisedMinimumMarginRequirement: BigNumber = await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy);
            expect(realisedMinimumMarginRequirement).to.eq(expectedMinimumMarginRequirement);

        })

        // passes
        it("correctly calculates the minimum margin requirement: fixed taker, IM, VT", async () => {

            const fixedTokenBalance: BigNumber = toBn("-3000");
            const variableTokenBalance: BigNumber = toBn("1000");
            
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

            const isLM: boolean = false;
            const twapApy: BigNumber = toBn("0.02");

            const expectedMinimumMarginRequirement: BigNumber = getMinimumMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, twapApy); // does not need the RATE_ORACLE_ID, can directly fetch the parameters represented as constants
            const realisedMinimumMarginRequirement: BigNumber = await calculatorTest.getMinimumMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy);
            expect(realisedMinimumMarginRequirement).to.eq(expectedMinimumMarginRequirement);

        })
    
    });


    describe("#getApyBound", async () => {

        beforeEach("deploy calculator", async () => {
            calculatorTest = await loadFixture(fixture);
            await calculatorTest.setMarginCalculatorParametersTest(
                RATE_ORACLE_ID, 
                APY_UPPER_MULTIPLIER, 
                APY_LOWER_MULTIPLIER,
                MIN_DELTA_LM,
                MIN_DELTA_IM,
                MAX_LEVERAGE, 
                SIGMA_SQUARED, 
                ALPHA,
                BETA, 
                XI_UPPER, 
                XI_LOWER 
            );

            const timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
            const timeInDaysFloor: BigNumber = floor(div(timeInSeconds, toBn(consts.ONE_DAY.toString())));
            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDaysFloor, DEFAULT_TIME_FACTOR);

        });


        // passes
        it("correctly computes the Upper APY Bound", async () => {

            const timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
            const twapApy: BigNumber = toBn("0.02");
            const isUpper: boolean = true;

            const expected: BigNumber = computeApyBound(RATE_ORACLE_ID, timeInSeconds, twapApy, isUpper);
            expect(await calculatorTest.computeApyBoundTest(RATE_ORACLE_ID, timeInSeconds, twapApy, isUpper)).to.be.closeTo(expected, 10000);

        })

        // passes
        it("correctly computes the Lower APY Bound", async () => {

            const timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
            const twapApy: BigNumber = toBn("0.02");
            const isUpper: boolean = false;

            const expected: BigNumber = computeApyBound(RATE_ORACLE_ID, timeInSeconds, twapApy, isUpper);
            expect(await calculatorTest.computeApyBoundTest(RATE_ORACLE_ID, timeInSeconds, twapApy, isUpper)).to.be.closeTo(expected, 10000);

        })

    })


    describe("#getTraderMarginRequirement", async () => {

        beforeEach("deploy calculator", async () => {
            calculatorTest = await loadFixture(fixture);
            await calculatorTest.setMarginCalculatorParametersTest(
                RATE_ORACLE_ID, 
                APY_UPPER_MULTIPLIER, 
                APY_LOWER_MULTIPLIER,
                MIN_DELTA_LM,
                MIN_DELTA_IM,
                MAX_LEVERAGE, 
                SIGMA_SQUARED, 
                ALPHA,
                BETA, 
                XI_UPPER, 
                XI_LOWER 
            );

            let timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
            let timeInDaysFloor: BigNumber = floor(div(timeInSeconds, toBn(consts.ONE_DAY.toString())));
            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDaysFloor, DEFAULT_TIME_FACTOR);

            timeInSeconds = toBn(consts.ONE_MONTH.toString());
            timeInDaysFloor = floor(div(timeInSeconds, toBn(consts.ONE_DAY.toString())));
            
            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDaysFloor, DEFAULT_TIME_FACTOR);

            timeInSeconds = toBn(consts.ONE_DAY.toString());
            timeInDaysFloor = floor(div(timeInSeconds, toBn(consts.ONE_DAY.toString())));
            
            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDaysFloor, DEFAULT_TIME_FACTOR);

        });
        
        // passes
        it("correctly calculates the trader margin requirement: VT, LM", async () => {

            const fixedTokenBalance: BigNumber = toBn("-3000");
            const variableTokenBalance: BigNumber = toBn("1000");
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());
        
            const isLM: boolean = false;
            const twapApy: BigNumber = toBn("0.02");

            const blockTimestampScaled: BigNumber = toBn((termStartTimestamp+1).toString());

            const expected: BigNumber = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy, blockTimestampScaled);
            expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

        // passes
        it("correctly calculates the trader margin requirement: FT, LM", async () => {

            const fixedTokenBalance: BigNumber = toBn("1000");
            const variableTokenBalance: BigNumber = toBn("-3000");
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());
        
            const isLM: boolean = false;
            const twapApy: BigNumber = toBn("0.02");

            const blockTimestampScaled: BigNumber = toBn((termStartTimestamp+1).toString());

            const expected: BigNumber = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy, blockTimestampScaled);
            expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

        it("correctly calculates the trader margin requirement: FT, IM", async () => {

            const fixedTokenBalance: BigNumber = toBn("1000");
            const variableTokenBalance: BigNumber = toBn("-3000");
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());
        
            const isLM: boolean = true;
            const twapApy: BigNumber = toBn("0.02");

            const blockTimestampScaled: BigNumber = toBn((termStartTimestamp+1).toString());

            const expected: BigNumber = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy, blockTimestampScaled);
            expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

        it("correctly calculates the trader margin requirement: VT, IM", async () => {

            const fixedTokenBalance: BigNumber = toBn("-3000");
            const variableTokenBalance: BigNumber = toBn("1000");
            
            const termStartTimestamp: number = await getCurrentTimestamp(provider);
            const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();
            
            const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
            const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());
        
            const isLM: boolean = true;
            const twapApy: BigNumber = toBn("0.02");

            const blockTimestampScaled: BigNumber = toBn((termStartTimestamp+1).toString());

            const expected: BigNumber = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy, blockTimestampScaled);
            expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestampBN, termEndTimestampBN, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

    })

    describe("#worstCaseVariableFactorAtMaturity", async () => {

        beforeEach("deploy calculator", async () => {
            calculatorTest = await loadFixture(fixture);
            await calculatorTest.setMarginCalculatorParametersTest(
                RATE_ORACLE_ID, 
                APY_UPPER_MULTIPLIER, 
                APY_LOWER_MULTIPLIER,
                MIN_DELTA_LM,
                MIN_DELTA_IM,
                MAX_LEVERAGE, 
                SIGMA_SQUARED, 
                ALPHA,
                BETA, 
                XI_UPPER, 
                XI_LOWER 
            );

            let timeInSeconds: BigNumber = toBn(consts.ONE_YEAR.toString());
            let timeInDaysFloor: BigNumber = floor(div(timeInSeconds, toBn(consts.ONE_DAY.toString())));
            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDaysFloor, DEFAULT_TIME_FACTOR);

            timeInSeconds = toBn(consts.ONE_MONTH.toString());
            timeInDaysFloor = floor(div(timeInSeconds, toBn(consts.ONE_DAY.toString())));
            await calculatorTest.setTimeFactorTest(RATE_ORACLE_ID, timeInDaysFloor, DEFAULT_TIME_FACTOR);

        });

        it("correctly calculates the worst case variable factor at maturity, FT, LM", async () => {

            const timeInSecondsFromStartToMaturity: BigNumber = toBn(consts.ONE_YEAR.toString());
            const timeInSecondsFromNowToMaturity: BigNumber = toBn(consts.ONE_MONTH.toString());
            const isFT: boolean = true;
            const isLM: boolean = true;
            const twapApy: BigNumber = toBn("0.02");    
                    
            const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy);
            expect(await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

        it("correctly calculates the worst case variable factor at maturity, FT, IM", async () => {

            const timeInSecondsFromStartToMaturity: BigNumber = toBn(consts.ONE_YEAR.toString());
            const timeInSecondsFromNowToMaturity: BigNumber = toBn(consts.ONE_MONTH.toString());
            const isFT: boolean = true;
            const isLM: boolean = false;
            const twapApy: BigNumber = toBn("0.02");    
                    
            const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy);
            expect(await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

        it("correctly calculates the worst case variable factor at maturity, VT, LM", async () => {

            const timeInSecondsFromStartToMaturity: BigNumber = toBn(consts.ONE_YEAR.toString());
            const timeInSecondsFromNowToMaturity: BigNumber = toBn(consts.ONE_MONTH.toString());
            const isFT: boolean = false;
            const isLM: boolean = true;
            const twapApy: BigNumber = toBn("0.02");    
                    
            const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy);
            expect(await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

        it("correctly calculates the worst case variable factor at maturity, VT, IM", async () => {

            const timeInSecondsFromStartToMaturity: BigNumber = toBn(consts.ONE_YEAR.toString());
            const timeInSecondsFromNowToMaturity: BigNumber = toBn(consts.ONE_MONTH.toString());
            const isFT: boolean = false;
            const isLM: boolean = false;
            const twapApy: BigNumber = toBn("0.02");    
                    
            const expected = worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy);
            expect(await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, RATE_ORACLE_ID, twapApy)).to.be.closeTo(expected, 10000);

        })

    })
    



    // todo: fix these small discrepancies
    // describe("worstCaseVariableFactorAtMaturity", async () => {

    //     it("correctly calculates the worst case variable factor at maturity, FT, LM", async () => {

    //         const termStartTimestamp: BigNumber = toBn("1636996083")
    //         const termEndTimestamp: BigNumber = toBn("1646996083")
    //         const timeInSeconds: BigNumber = sub(termEndTimestamp, termStartTimestamp)
    //         const isLM: boolean = true
    //         const isFT: boolean = true

    //         const expected = worstCaseVariableFactorAtMaturity(timeInSeconds, isFT, isLM)
    //         expect(await calculatorTest.worstCaseVariableFactorAtMaturityTest(timeInSeconds, isFT, isLM)).to.eq(expected)

    //     })
    // })

    // describe("#getTraderMarginRequirement", async () => {

    //     it("correctly calculates the trader margin requirement", async () => {

    //         const fixedTokenBalance: BigNumber = toBn("1000")
    //         const variableTokenBalance: BigNumber = toBn("-2000")
    //         const termStartTimestamp: BigNumber = toBn("1636996083")
    //         const termEndTimestamp: BigNumber = toBn("1646996083")
    //         const isLM: boolean = false

    //         const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
    //         expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

    //     })

    //     it("correctly calculates the trader margin requirement", async () => {

    //         const fixedTokenBalance: BigNumber = toBn("1000")
    //         const variableTokenBalance: BigNumber = toBn("-2000")
    //         const termStartTimestamp: BigNumber = toBn("1636996083")
    //         const termEndTimestamp: BigNumber = toBn("1646996083")
    //         const isLM: boolean = true

    //         const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
    //         expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

    //     })

    //     // todo: fails
    //     // it("correctly calculates the trader margin requirement", async () => {

    //     //     const fixedTokenBalance: BigNumber = toBn("-1000")
    //     //     const variableTokenBalance: BigNumber = toBn("2000")
    //     //     const termStartTimestamp: BigNumber = toBn("1636996083")
    //     //     const termEndTimestamp: BigNumber = toBn("1646996083")
    //     //     const isLM: boolean = true

    //     //     const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
    //     //     expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

    //     // })

    //     // todo: fails
    //     // it("correctly calculates the trader margin requirement", async () => {

    //     //     const fixedTokenBalance: BigNumber = toBn("-1000")
    //     //     const variableTokenBalance: BigNumber = toBn("2000")
    //     //     const termStartTimestamp: BigNumber = toBn("1636996083")
    //     //     const termEndTimestamp: BigNumber = toBn("1646996083")
    //     //     const isLM: boolean = false

    //     //     const expected = getTraderMarginRequirement(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)
    //     //     expect(await calculatorTest.getTraderMarginRequirementTest(fixedTokenBalance, variableTokenBalance, termStartTimestamp, termEndTimestamp, isLM)).to.eq(expected)

    //     // })

    //     // todo: introduce tests for scenarios where the minimum margin requirement is higher, lower, modelMargin is negative, positive, etc

    // })

})