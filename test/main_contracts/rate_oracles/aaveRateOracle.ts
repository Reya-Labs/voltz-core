import { BigNumber, Wallet, Contract } from "ethers";
import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { toBn } from "../../helpers/toBn";
import { div, sub, add, pow } from "../../shared/functions";
import { TestRateOracle } from "../../../typechain/TestRateOracle";
import {
  rateOracleTestFixture,
  mockERC20Fixture,
  mockAaveLendingPoolFixture,
} from "../../shared/fixtures";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
import { SECONDS_IN_YEAR } from "../../shared/utilities";
import Decimal from "decimal.js-light";

const { provider } = waffle;

function computeApyFromRate(rateFromTo: BigNumber, timeInYears: BigNumber) {
  const exponent: BigNumber = div(toBn("1.0"), timeInYears);
  const apyPlusOne: BigNumber = pow(add(toBn("1.0"), rateFromTo), exponent);
  const apy: BigNumber = sub(apyPlusOne, toBn("1.0"));
  return apy;
}

// function interpolateRateValue(
//   beforeOrAtRateValue: BigNumber,
//   apyFromBeforeOrAtToAtOrAfter: BigNumber,
//   timeDeltaBeforeOrAtToQueriedTime: BigNumber
// ) {
//   const timeInYears = accrualFact(timeDeltaBeforeOrAtToQueriedTime);
//   const exp1 = sub(
//     pow(add(toBn("1.0"), apyFromBeforeOrAtToAtOrAfter), timeInYears),
//     toBn("1.0")
//   );

//   const rateValue = mul(beforeOrAtRateValue, exp1);

//   return rateValue;
// }

describe("Aave Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  const oracleFixture = async () => {
    const { token } = await mockERC20Fixture();
    const { aaveLendingPool } = await mockAaveLendingPoolFixture();

    // console.log(
    //   "Test TS: Aave lending pool address is: ",
    //   aaveLendingPool.address
    // );

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      toBn("1.0") // should be in ray
    );
    // console.log(
    //   "Test TS: Aave normalized income is: ",
    //   await aaveLendingPool.getReserveNormalizedIncome(token.address)
    // );

    const { rateOracleTest } = await rateOracleTestFixture(
      aaveLendingPool.address,
      token.address
    );

    await rateOracleTest.setMinSecondsSinceLastUpdate(7200); // two hours
    return rateOracleTest;
  };

  const initializedOracleFixture = async () => {
    const testRateOracle = await oracleFixture();
    return testRateOracle;
  };

  describe("#initialize", () => {
    let testRateOracle: TestRateOracle;
    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
    });

    // it("aave lending pool set correctly", async () => {
    //   const normalizedIncome =
    //     await testRateOracle.testGetReserveNormalizedIncome();
    //   expect(normalizedIncome).to.eq(toBn("1.0"));
    // });

    it("rateIndex, rateCardinality, rateCardinalityNext correctly initialized", async () => {
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(1);
    });
  });

  describe("#grow", () => {
    let testRateOracle: TestRateOracle;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
      // await testRateOracle.initializeTestRateOracle({
      //   tick: 1,
      //   liquidity: 1
      // });
    });

    it("increases the cardinality next for the first call", async () => {
      await testRateOracle.increaseObservarionCardinalityNext(5);
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(5);
    });

    it("is no op if oracle is already gte that size", async () => {
      await testRateOracle.increaseObservarionCardinalityNext(5);
      await testRateOracle.increaseObservarionCardinalityNext(3);
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(5);
    });
  });

  describe("#write", () => {
    let testRateOracle: TestRateOracle;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
    });

    it("single element array gets overwritten", async () => {
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const currentTimestamp = await getCurrentTimestamp(provider);
      await testRateOracle.writeOracleEntry();
      const [rateIndex] = await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      const [rateTimestamp, rateValue] = await testRateOracle.getRate(0);
      // console.log(`currentTimestamp: ${currentTimestamp}`);
      // console.log(`rateTimestamp: ${rateTimestamp.valueOf()}`);
      expect(rateValue).to.eq(toBn("1.0"));
      expect(rateTimestamp).to.eq(currentTimestamp + 1);
    });

    it("grows cardinality if writing past", async () => {
      await testRateOracle.increaseObservarionCardinalityNext(2);
      await testRateOracle.increaseObservarionCardinalityNext(4);
      let [rateIndex, rateCardinality] = await testRateOracle.getOracleVars();
      expect(rateCardinality).to.eq(1);
      // console.log(await getCurrentTimestamp(provider));
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // console.log(await getCurrentTimestamp(provider));
      await testRateOracle.writeOracleEntry();
      [rateIndex, rateCardinality] = await testRateOracle.getOracleVars();
      expect(rateCardinality).to.eq(4);
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const currentTimestamp = await getCurrentTimestamp(provider);
      await testRateOracle.writeOracleEntry();
      [rateIndex, rateCardinality] = await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(2);
      expect(rateCardinality).to.eq(4);
      const [rateTimestamp, rateValue] = await testRateOracle.getRate(2);
      expect(rateValue).to.eq(toBn("1.0"));
      expect(rateTimestamp).to.eq(currentTimestamp + 1);
    });
  });

  describe("#getRateFromTo", async () => {
    let testRateOracle: TestRateOracle;
    let aaveLendingPoolContract: Contract;
    let underlyingTokenAddress: string;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
      const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
      underlyingTokenAddress = await testRateOracle.underlying();
      const aaveLendingPoolAbi = [
        "function getReserveNormalizedIncome(address _underlyingAsset) public view returns (uint256)",
        "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
      ];
      aaveLendingPoolContract = new Contract(
        aaveLendingPoolAddress,
        aaveLendingPoolAbi,
        provider
      ).connect(wallet);
    });

    it("correctly calculates rate from one timestamp to the next", async () => {
      await testRateOracle.increaseObservarionCardinalityNext(4);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPoolContract.setReserveNormalizedIncome(
        underlyingTokenAddress,
        toBn("1.1")
      );
      const rateToTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await testRateOracle.testGetRateFromTo(
        rateFromTimestamp,
        rateToTimestamp
      );
      const rateFromTo = await testRateOracle.latestRateFromTo();

      const expectedRateFromTo = toBn("0.1");

      expect(rateFromTo).to.eq(expectedRateFromTo);
    });
  });

  const interpolateRateValue = (
    principal: Decimal,
    apy: Decimal,
    seconds: Decimal
  ): Decimal => {
    console.log("1");
    const secondsPerYear = new Decimal(31536000);
    const timeInYears = seconds.div(secondsPerYear);
    const apyFactor = apy.plus(1);
    console.log("2");
    const resultAsDecimal = principal.times(apyFactor.pow(timeInYears));
    console.log("result:", resultAsDecimal.toFixed(10));
    // convert to way
    return resultAsDecimal.times(1e18);
  };

  describe.only("#interpolateRateValue", async () => {
    let testRateOracle: TestRateOracle;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
    });

    // Get back to this
    it("correctly interpolates the rate value", async () => {
      const PRECISION = 10;
      const secondsPerYear = 31536000;
      const startRate = 1;
      const factorPerSecond = 1.00000001;
      const rayDecimals = 27;
      let apyPlusOne = Number(
        new Decimal(factorPerSecond).pow(secondsPerYear).toFixed(PRECISION)
      );
      console.log("apy", apyPlusOne);

      const timeInSeconds = 86400;

      const realizedInterpolatedRateValue =
        await testRateOracle.interpolateRateValue(
          toBn(startRate, rayDecimals),
          toBn(apyPlusOne - 1),
          toBn(timeInSeconds)
        ); // one week
      // const expectedRateValue = interpolateRateValue(
      //   new Decimal("1.0"),
      //   new Decimal("0.1"),
      //   new Decimal("604800")
      // );
      // const expectedRateValue = 0;
      const timeInYears = timeInSeconds / secondsPerYear;
      const factor = new Decimal(apyPlusOne).pow(timeInYears);
      const expectedValue = Number(factor.mul(startRate).toFixed(PRECISION));
      const expectedValueInRay = toBn(
        expectedValue.toFixed(PRECISION),
        rayDecimals
      );
      console.log("timeInYears", timeInYears);
      console.log("expectedValue", expectedValue);
      // expect(realizedInterpolatedRateValue).to.eq(toBn(expectedValue));
      const closeTo = await testRateOracle.rayValueIsCloseTo(
        realizedInterpolatedRateValue,
        expectedValueInRay
      );
      console.log("closeTo=", closeTo);
      if (!closeTo) {
        // Fail
        expect(realizedInterpolatedRateValue).to.eq(expectedValueInRay);
      }
    });
  });

  describe("#binarySearch", async () => {
    let testRateOracle: TestRateOracle;
    let aaveLendingPoolContract: Contract;
    let underlyingTokenAddress: string;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);

      const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
      underlyingTokenAddress = await testRateOracle.underlying();
      const aaveLendingPoolAbi = [
        "function getReserveNormalizedIncome(address _underlyingAsset) public view returns (uint256)",
        "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
      ];
      aaveLendingPoolContract = new Contract(
        aaveLendingPoolAddress,
        aaveLendingPoolAbi,
        provider
      ).connect(wallet);
    });

    it("binary search works as expected", async () => {
      await testRateOracle.increaseObservarionCardinalityNext(4);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPoolContract.setReserveNormalizedIncome(
        underlyingTokenAddress,
        toBn("1.1")
      );
      const afterOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      const targetTimestamp = Math.floor(
        (beforeOrAtTimestamp + afterOrAtTimestamp) / 2
      );

      const [beforeOrAtRateValue, afterOrAtRateValue] =
        await testRateOracle.binarySearch(targetTimestamp);
      expect(beforeOrAtRateValue.observedValue).to.eq(toBn("1.0"));
      expect(afterOrAtRateValue.observedValue).to.eq(toBn("1.1"));
    });

    // other scenarios
  });

  describe("#getSurroundingRates", async () => {
    let testRateOracle: TestRateOracle;
    let aaveLendingPoolContract: Contract;
    let underlyingTokenAddress: string;

    let beforeOrAtTimestamp: number;
    let atOrAfterTimestamp: number;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);

      const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
      underlyingTokenAddress = await testRateOracle.underlying();
      const aaveLendingPoolAbi = [
        "function getReserveNormalizedIncome(address _underlyingAsset) public view returns (uint256)",
        "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
      ];
      aaveLendingPoolContract = new Contract(
        aaveLendingPoolAddress,
        aaveLendingPoolAbi,
        provider
      ).connect(wallet);

      await testRateOracle.increaseObservarionCardinalityNext(6);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPoolContract.setReserveNormalizedIncome(
        underlyingTokenAddress,
        toBn("1.1")
      );
      atOrAfterTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();
    });

    it("target is beforeOrAt", async () => {
      await testRateOracle.testGetSurroundingRates(beforeOrAtTimestamp);

      const realizedBeforeOrAtRateValue =
        await testRateOracle.latestBeforeOrAtRateValue();
      const realizedAtOrAfterValue =
        await testRateOracle.latestAfterOrAtRateValue();

      // console.log(realizedBeforeOrAtRateValue);
      // console.log(realizedAtOrAfterValue);

      expect(realizedBeforeOrAtRateValue).to.eq(toBn("1.0"));
      expect(realizedAtOrAfterValue).to.eq(toBn("1.1"));
    });

    it("target is atOrAfter", async () => {
      await testRateOracle.testGetSurroundingRates(atOrAfterTimestamp);

      const realizedBeforeOrAtRateValue =
        await testRateOracle.latestBeforeOrAtRateValue();
      const realizedAtOrAfterValue =
        await testRateOracle.latestAfterOrAtRateValue();

      // console.log(realizedBeforeOrAtRateValue);
      // console.log(realizedAtOrAfterValue);

      expect(realizedBeforeOrAtRateValue).to.eq(toBn("1.1"));
      expect(realizedAtOrAfterValue).to.eq(0);
    });

    it("target is in the middle", async () => {
      const targetTimestamp = Math.floor(
        (beforeOrAtTimestamp + atOrAfterTimestamp) / 2
      );

      await testRateOracle.testGetSurroundingRates(targetTimestamp);

      const realizedBeforeOrAtRateValue =
        await testRateOracle.latestBeforeOrAtRateValue();
      const realizedAtOrAfterValue =
        await testRateOracle.latestAfterOrAtRateValue();

      // does binary search

      expect(realizedBeforeOrAtRateValue).to.eq(toBn("1.0"));
      expect(realizedAtOrAfterValue).to.eq(toBn("1.1"));
    });

    it("fails if target is too old", async () => {
      const targetTimestamp = beforeOrAtTimestamp - 604800; // going back one week

      await expect(testRateOracle.testGetSurroundingRates(targetTimestamp)).to
        .be.reverted;
    });
  });

  describe("#computeApyFromRate", async () => {
    let testRateOracle: TestRateOracle;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
    });

    it("correctly computes apy", async () => {
      const realizedApy = await testRateOracle.testComputeApyFromRate(
        toBn("0.1"),
        toBn("0.5")
      );
      const expectedApy = computeApyFromRate(toBn("0.1"), toBn("0.5"));
      expect(realizedApy).to.be.closeTo(expectedApy, 100);
    });
  });

  describe("#variableFactor", async () => {
    let testRateOracle: TestRateOracle;
    let aaveLendingPoolContract: Contract;
    let underlyingTokenAddress: string;

    let firstTimestamp: number;
    let secondTimestamp: number;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);

      const aaveLendingPoolAddress = await testRateOracle.aaveLendingPool();
      underlyingTokenAddress = await testRateOracle.underlying();
      const aaveLendingPoolAbi = [
        "function getReserveNormalizedIncome(address _underlyingAsset) public view returns (uint256)",
        "function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public",
      ];
      aaveLendingPoolContract = new Contract(
        aaveLendingPoolAddress,
        aaveLendingPoolAbi,
        provider
      ).connect(wallet);

      await testRateOracle.increaseObservarionCardinalityNext(10);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      firstTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPoolContract.setReserveNormalizedIncome(
        underlyingTokenAddress,
        toBn("1.1")
      );
      secondTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();
    });

    it("calculate variable factor at maturity", async () => {
      const termStartTimestampBN = toBn(firstTimestamp.toString());
      const termEndTimestampBN = toBn(secondTimestamp.toString());
      const realizedVariableFactor = await testRateOracle.variableFactorNoCache(
        termStartTimestampBN,
        termEndTimestampBN
      );
      const expectedVariableFactor = toBn("0.1");
      expect(realizedVariableFactor).to.eq(expectedVariableFactor);
    });

    it("calculate variable factor after maturity", async () => {
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const termStartTimestampBN = toBn(firstTimestamp.toString());
      const termEndTimestampBN = toBn(secondTimestamp.toString());
      const realizedVariableFactor = await testRateOracle.variableFactorNoCache(
        termStartTimestampBN,
        termEndTimestampBN
      );
      const expectedVariableFactor = toBn("0.1");
      expect(realizedVariableFactor).to.eq(expectedVariableFactor);
    });

    it("calculates variable factor before maturity", async () => {
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      await aaveLendingPoolContract.setReserveNormalizedIncome(
        underlyingTokenAddress,
        toBn("1.2")
      );

      const termStartTimestampBN = toBn(firstTimestamp.toString());
      const termEndTimestampBN = toBn((secondTimestamp + 604800).toString());

      const realizedVariableFactor = await testRateOracle.variableFactorNoCache(
        termStartTimestampBN,
        termEndTimestampBN
      );

      const expectedVariableFactor = toBn("0.2");
      expect(realizedVariableFactor).to.eq(expectedVariableFactor);
    });

    it("reverts if termStartTimestamp is too old", async () => {
      const termStartTimestampBN = toBn((firstTimestamp - 31536000).toString());
      const termEndTimestampBN = toBn((secondTimestamp + 604800).toString());

      await expect(
        testRateOracle.variableFactorNoCache(
          termStartTimestampBN,
          termEndTimestampBN
        )
      ).to.be.reverted;
    });
  });
});
