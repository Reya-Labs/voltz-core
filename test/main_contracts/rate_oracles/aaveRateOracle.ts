import { BigNumber, Wallet } from "ethers";
import { ethers, waffle, deployments } from "hardhat";
import { expect } from "chai";
import { toBn } from "../../helpers/toBn";
import { div, sub, add, pow } from "../../shared/functions";
import {
  rateOracleTestFixture,
  mockERC20Fixture,
  mockAaveLendingPoolFixture,
} from "../../shared/fixtures";
import {
  advanceTime,
  advanceTimeAndBlock,
  getCurrentTimestamp,
  setTimeNextBlock,
} from "../../helpers/time";
import Decimal from "decimal.js-light";
import {
  ERC20Mock,
  MockAaveLendingPool,
  TestRateOracle,
} from "../../../typechain";
import { consts } from "../../helpers/constants";

const { provider } = waffle;

function computeApyFromRate(rateFromTo: BigNumber, timeInYears: BigNumber) {
  const exponent: BigNumber = div(toBn("1.0"), timeInYears);
  const apyPlusOne: BigNumber = pow(add(toBn("1.0"), rateFromTo), exponent);
  const apy: BigNumber = sub(apyPlusOne, toBn("1.0"));
  return apy;
}

let token: ERC20Mock;
let aaveLendingPool: MockAaveLendingPool;
let testRateOracle: TestRateOracle;

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
    const { token: _token } = await mockERC20Fixture();
    const { aaveLendingPool: _aaveLendingPool } =
      await mockAaveLendingPoolFixture();

    // console.log(
    //   "Test TS: Aave lending pool address is: ",
    //   aaveLendingPool.address
    // );

    await _aaveLendingPool.setReserveNormalizedIncome(
      _token.address,
      toBn("1.0", consts.AAVE_RATE_DECIMALS) // should be in ray
    );
    // console.log(
    //   "Test TS: Aave normalized income is: ",
    //   await aaveLendingPool.getReserveNormalizedIncome(token.address)
    // );

    const { rateOracleTest } = await rateOracleTestFixture(
      _aaveLendingPool.address,
      _token.address
    );

    await rateOracleTest.setMinSecondsSinceLastUpdate(0); // test without caching by default
    return {
      testRateOracle: rateOracleTest,
      token: _token,
      aaveLendingPool: _aaveLendingPool,
    };
  };

  // const initializedOracleFixture = async () => {
  //   const testRateOracle = await oracleFixture();
  //   return testRateOracle;
  // };

  describe("#initialize", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      // ({ testRateOracle } = await loadFixture(oracleFixture));
      await deployments.fixture(["Factory", "Mocks", "RateOracles"]);
      const aaveLendingPool = await ethers.getContract("MockAaveLendingPool");
      const token = await ethers.getContract("ERC20Mock");
      const TestRateOracleFactory = await ethers.getContractFactory(
        "TestRateOracle"
      );
      testRateOracle = (await TestRateOracleFactory.deploy(
        aaveLendingPool.address,
        token.address
      )) as TestRateOracle;
    });

    // it("aave lending pool set correctly", async () => {
    //   const normalizedIncome =
    //     await testRateOracle.testGetReserveNormalizedIncome();
    //   expect(normalizedIncome).to.eq(toBn("1.0"));
    // });

    it("rateIndex, rateCardinality, rateCardinalityNext correctly initialized", async () => {
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(1);
    });
  });

  describe("#grow", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      await deployments.fixture(["Factory", "Mocks", "RateOracles"]);
      const aaveLendingPool = await ethers.getContract("MockAaveLendingPool");
      const token = await ethers.getContract("ERC20Mock");
      const TestRateOracleFactory = await ethers.getContractFactory(
        "TestRateOracle"
      );
      testRateOracle = (await TestRateOracleFactory.deploy(
        aaveLendingPool.address,
        token.address
      )) as TestRateOracle;
      // await testRateOracle.initializeTestRateOracle({
      //   tick: 1,
      //   liquidity: 1
      // });
    });

    it("increases the cardinality next for the first call", async () => {
      await testRateOracle.increaseObservationCardinalityNext(5);
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(5);
    });

    it("is no op if oracle is already gte that size", async () => {
      await testRateOracle.increaseObservationCardinalityNext(5);
      await testRateOracle.increaseObservationCardinalityNext(3);
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(5);
    });
  });

  describe("#write", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle } = await loadFixture(oracleFixture));
    });

    it("single element array gets overwritten", async () => {
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const currentTimestamp = await getCurrentTimestamp(provider);
      await testRateOracle.writeOracleEntry();
      const [rateIndex] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(0);
      const [rateTimestamp, rateValue, _] = await testRateOracle.observations(
        0
      );
      // console.log(`currentTimestamp: ${currentTimestamp}`);
      // console.log(`rateTimestamp: ${rateTimestamp.valueOf()}`);
      expect(rateValue).to.eq(toBn("1.0", consts.AAVE_RATE_DECIMALS));
      expect(rateTimestamp).to.eq(currentTimestamp + 1);
    });

    it("grows cardinality if writing past", async () => {
      await testRateOracle.increaseObservationCardinalityNext(2);
      await testRateOracle.increaseObservationCardinalityNext(4);
      let [rateIndex, rateCardinality] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      // console.log(await getCurrentTimestamp(provider));
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // console.log(await getCurrentTimestamp(provider));
      await testRateOracle.writeOracleEntry();
      [rateIndex, rateCardinality] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(1);
      expect(rateCardinality).to.eq(4);
      const minSecondsSinceLastUpdate =
        await testRateOracle.minSecondsSinceLastUpdate();
      await advanceTimeAndBlock(minSecondsSinceLastUpdate.add(1), 2); // advance by more than minSecondsSinceLastUpdate
      const currentTimestamp = await getCurrentTimestamp(provider);
      await testRateOracle.writeOracleEntry();
      [rateIndex, rateCardinality] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(2);
      expect(rateCardinality).to.eq(4);
      const [rateTimestamp, rateValue, _] = await testRateOracle.observations(
        2
      );
      expect(rateValue).to.eq(toBn("1.0", consts.AAVE_RATE_DECIMALS));
      expect(rateTimestamp).to.eq(currentTimestamp + 1);
    });

    it("does not grow cardinality if insufficient time has passed", async () => {
      await testRateOracle.setMinSecondsSinceLastUpdate(7200); // two hours
      await testRateOracle.increaseObservationCardinalityNext(2);
      await testRateOracle.increaseObservationCardinalityNext(4);
      let [rateIndex, rateCardinality] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      // console.log(await getCurrentTimestamp(provider));
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const currentTimestamp = await getCurrentTimestamp(provider);
      await testRateOracle.writeOracleEntry();
      [rateIndex, rateCardinality] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(1);
      expect(rateCardinality).to.eq(4);
      const minSecondsSinceLastUpdate =
        await testRateOracle.minSecondsSinceLastUpdate();
      await advanceTimeAndBlock(minSecondsSinceLastUpdate.sub(100), 2); // advance by less than minSecondsSinceLastUpdate
      await testRateOracle.writeOracleEntry();
      [rateIndex, rateCardinality] = await testRateOracle.oracleVars();
      expect(rateIndex).to.eq(1); // Should be unchanged since insufficient time passed to write new rate
      expect(rateCardinality).to.eq(4);
      const [rateTimestamp, rateValue, _] = await testRateOracle.observations(
        1
      );
      expect(rateValue).to.eq(toBn("1.0", consts.AAVE_RATE_DECIMALS));
      expect(rateTimestamp).to.eq(currentTimestamp + 1); // TImestemp from *before* last write
    });
  });

  describe("#getRateFromTo", async () => {
    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle, token, aaveLendingPool } = await loadFixture(
        oracleFixture
      ));
    });

    it("correctly calculates rate from one timestamp to the next", async () => {
      await testRateOracle.increaseObservationCardinalityNext(4);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
      );
      await testRateOracle.writeOracleEntry();
      const rateToTimestamp = await getCurrentTimestamp(provider);

      const rateFromTo = await testRateOracle.getRateFromTo(
        rateFromTimestamp,
        rateToTimestamp
      );

      const expectedRateFromTo = toBn("0.1");

      expect(rateFromTo).to.eq(expectedRateFromTo);
    });

    it("correctly calculates rate from one timestamp to the next when there was no recent write", async () => {
      await testRateOracle.increaseObservationCardinalityNext(4);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400).mul(5), 500); // advance by 500 days
      const rateFromTimestamp = await getCurrentTimestamp(provider);
      await advanceTimeAndBlock(BigNumber.from(86400).mul(5), 500); // advance by 500 days

      // set new liquidity index value
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        toBn("1.21", consts.AAVE_RATE_DECIMALS) // Factor of 1.1 every 500 days
      );
      const rateToTimestamp = await getCurrentTimestamp(provider);

      const rateFromTo = await testRateOracle.getRateFromTo(
        rateFromTimestamp,
        rateToTimestamp
      );

      const expectedRateFromTo = toBn("0.1");

      expect(rateFromTo).to.be.closeTo(expectedRateFromTo, 100_000_000_000_000); // within 1e14 of 1e18 = within 0.01%
    });
  });

  describe("#getApyFromTo", async () => {
    const oneInRay = toBn("1", consts.AAVE_RATE_DECIMALS);
    const expectedApy = toBn("1.3707526909509977", consts.AAVE_RATE_DECIMALS); // This is equivalent to compounding by 1.00000001 per second for 365 days = 31536000 seconds
    const twoYearMultiple = toBn(
      "1.8789629397494015",
      consts.AAVE_RATE_DECIMALS
    ); // This is equivalent to compounding by 1.00000001 per second for 2 years = 63072000 seconds
    let startTime: number;

    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle, token, aaveLendingPool } = await loadFixture(
        oracleFixture
      ));

      await testRateOracle.increaseObservationCardinalityNext(10);
      await aaveLendingPool.setReserveNormalizedIncome(token.address, oneInRay);
      await testRateOracle.writeOracleEntry();
      startTime = await getCurrentTimestamp();

      // One year passes
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        expectedApy
      );
      await setTimeNextBlock(startTime + 31536000); // One year after first reading
      await testRateOracle.writeOracleEntry();

      // Another year passes
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        twoYearMultiple
      );
      await setTimeNextBlock(startTime + 2 * 31536000); // Two years year after first reading
      await testRateOracle.writeOracleEntry();

      // 5 more years pass before tests
      await advanceTime(5 * 31536000);
    });

    it("correctly calculates APY between two known, consecutive data points", async () => {
      const apy = await testRateOracle.getApyFromTo(
        startTime,
        startTime + 31536000
      );
      expect(apy).to.be.closeTo(
        expectedApy.sub(oneInRay).div(1e9), // convert rate in ray to APY in wad
        100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
      );
    });

    it("correctly calculates APY between two known, NON-consecutive data points", async () => {
      const apy = await testRateOracle.getApyFromTo(
        startTime,
        startTime + 2 * 31536000
      );
      expect(apy).to.be.closeTo(
        expectedApy.sub(oneInRay).div(1e9), // convert rate in ray to APY in wad
        100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
      );
    });

    it("correctly calculates APY for intervals IN BETWEEN consecutive data points", async () => {
      const apy = await testRateOracle.getApyFromTo(
        startTime + 100000,
        startTime + 10000000
      );
      expect(apy).to.be.closeTo(
        expectedApy.sub(oneInRay).div(1e9), // convert rate in ray to APY in wad
        100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
      );
    });

    it("correctly calculates APY for intervals across data points", async () => {
      const apy = await testRateOracle.getApyFromTo(
        startTime + 20000000,
        startTime + 40000000
      );
      expect(apy).to.be.closeTo(
        expectedApy.sub(oneInRay).div(1e9), // convert rate in ray to APY in wad
        100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
      );
    });
  });

  describe("#interpolateRateValue", async () => {
    const PRECISION = 10;
    const secondsPerYear = 31536000;

    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle } = await loadFixture(oracleFixture));
    });

    class InterpolateTest {
      public description: string;
      constructor(
        public startRate: number,
        public factorPerSecond: number,
        public timeInSeconds: number,
        _description?: string
      ) {
        if (_description) {
          this.description = `: ${_description}`;
        } else {
          this.description = `(${startRate}, ${factorPerSecond}, ${timeInSeconds})`;
        }
      }
    }

    const tests = [
      new InterpolateTest(1, 1.00000001, 86400),
      new InterpolateTest(1, 1.0000000001, 3600),
      new InterpolateTest(1, 1.000000000001, 60),
      new InterpolateTest(
        1,
        1.000000000000001,
        1,
        "1 second at insanely low interest"
      ),
      new InterpolateTest(1, 1, 86400, "zero interest"),
      new InterpolateTest(1, 1, 1, "zero interest (one second)"),
      // new InterpolateTest(1, 0.9999999, 86400), // negative interest (factor < 1) not supported?
      // new InterpolateTest(1, 0.9999999, 1), // negative interest (factor < 1) not supported?
      new InterpolateTest(1, 1.000000001, 1),
      new InterpolateTest(50, 1.000000001, 86400),
      new InterpolateTest(50, 1.000000001, 1),
      new InterpolateTest(1, 1.000000001, 7776000, "3 months"),
      new InterpolateTest(2, 1.000001, 1),
      new InterpolateTest(
        1,
        1.000001,
        7776000,
        "3 months @ insanely high interest"
      ),
    ];

    tests.forEach(function (t) {
      it(`interpolateRateValue${t.description}`, async () => {
        const apyPlusOne = Number(
          new Decimal(t.factorPerSecond).pow(secondsPerYear).toFixed(PRECISION)
        );
        const realizedInterpolatedRateValue =
          await testRateOracle.interpolateRateValue(
            toBn(t.startRate, consts.AAVE_RATE_DECIMALS), // Starting value in ray
            toBn(apyPlusOne - 1),
            toBn(t.timeInSeconds)
          );

        if (t.factorPerSecond === 0) {
          expect(realizedInterpolatedRateValue).to.eq(
            toBn(t.startRate, consts.AAVE_RATE_DECIMALS)
          );
        } else {
          const timeInYears = t.timeInSeconds / secondsPerYear;
          const factor = new Decimal(apyPlusOne).pow(timeInYears);
          const expectedValue = Number(
            factor.mul(t.startRate).toFixed(PRECISION)
          );
          const expectedValueInRay = toBn(
            expectedValue.toFixed(PRECISION),
            consts.AAVE_RATE_DECIMALS
          );

          // "Close to" is good enough
          const closeTo = await testRateOracle.rayValueIsCloseTo(
            realizedInterpolatedRateValue,
            expectedValueInRay
          );
          if (!closeTo) {
            // Fail
            expect(realizedInterpolatedRateValue).to.eq(expectedValueInRay);
          }
        }
      });
    });
  });

  describe("#binarySearch", async () => {
    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle, token, aaveLendingPool } = await loadFixture(
        oracleFixture
      ));
    });

    it("binary search works as expected", async () => {
      await testRateOracle.increaseObservationCardinalityNext(4);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
      );
      const afterOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      const targetTimestamp = Math.floor(
        (beforeOrAtTimestamp + afterOrAtTimestamp) / 2
      );

      const [beforeOrAtRateValue, afterOrAtRateValue] =
        await testRateOracle.binarySearch(targetTimestamp);
      expect(beforeOrAtRateValue.observedValue).to.eq(
        toBn("1.0", consts.AAVE_RATE_DECIMALS)
      );
      expect(afterOrAtRateValue.observedValue).to.eq(
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
      );
    });

    // other scenarios
  });

  describe("#getSurroundingRates", async () => {
    let beforeOrAtTimestamp: number;
    let atOrAfterTimestamp: number;

    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle, token, aaveLendingPool } = await loadFixture(
        oracleFixture
      ));

      await testRateOracle.increaseObservationCardinalityNext(6);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
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

      expect(realizedBeforeOrAtRateValue).to.eq(
        toBn("1.0", consts.AAVE_RATE_DECIMALS)
      );
      expect(realizedAtOrAfterValue).to.eq(
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
      );
    });

    it("target is atOrAfter", async () => {
      await testRateOracle.testGetSurroundingRates(atOrAfterTimestamp);

      const realizedBeforeOrAtRateValue =
        await testRateOracle.latestBeforeOrAtRateValue();
      const realizedAtOrAfterValue =
        await testRateOracle.latestAfterOrAtRateValue();

      expect(realizedBeforeOrAtRateValue).to.eq(
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
      );
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

      expect(realizedBeforeOrAtRateValue).to.eq(
        toBn("1.0", consts.AAVE_RATE_DECIMALS)
      );
      expect(realizedAtOrAfterValue).to.eq(
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
      );
    });

    it("fails if target is too old", async () => {
      const targetTimestamp = beforeOrAtTimestamp - 604800; // going back one week

      await expect(testRateOracle.testGetSurroundingRates(targetTimestamp)).to
        .be.reverted;
    });
  });

  describe("#computeApyFromRate", async () => {
    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle } = await loadFixture(oracleFixture));
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
    let firstTimestamp: number;
    let secondTimestamp: number;

    beforeEach("deploy and initialize test oracle", async () => {
      ({ testRateOracle, token, aaveLendingPool } = await loadFixture(
        oracleFixture
      ));

      await testRateOracle.increaseObservationCardinalityNext(10);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      firstTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // set new liquidity index value
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        toBn("1.1", consts.AAVE_RATE_DECIMALS)
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
      await aaveLendingPool.setReserveNormalizedIncome(
        token.address,
        toBn("1.2", consts.AAVE_RATE_DECIMALS)
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
