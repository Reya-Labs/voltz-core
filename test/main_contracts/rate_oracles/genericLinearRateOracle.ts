import { BigNumber } from "ethers";
import { waffle } from "hardhat";
import { expect } from "chai";
import path from "path";
import { toBn } from "../../helpers/toBn";
import {
  advanceTime,
  advanceTimeAndBlock,
  getCurrentTimestamp,
  setTimeNextBlock,
} from "../../helpers/time";
import { TestGlpRateOracle } from "../../../typechain";
import { consts } from "../../helpers/constants";
import { ConfigForGenericTests } from "./glpConfig";

const { provider } = waffle;

let testRateOracle: TestGlpRateOracle;

// Modify this list to test new rate oracles
const CONFIGURATIONS_UNDER_TEST = [ConfigForGenericTests];

describe("Generic Linear Rate Oracle Tests", () => {
  for (const Config of CONFIGURATIONS_UNDER_TEST) {
    // console.log(`Testing ${Config.configName}...`);

    describe(`${Config.configName} Rate Oracle (from ${path.basename(
      __filename
    )})`, () => {
      describe("#initialize", () => {
        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());
        });

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
          ({ testRateOracle } = await Config.oracleFixture());
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
          ({ testRateOracle } = await Config.oracleFixture());
        });

        it("single element array gets overwritten", async () => {
          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          const currentTimestamp = await getCurrentTimestamp(provider);
          await testRateOracle.writeOracleEntry();
          const [rateIndex] = await testRateOracle.oracleVars();
          expect(rateIndex).to.eq(0);
          const [rateTimestamp, rateValue, _] =
            await testRateOracle.observations(0);
          // console.log(`currentTimestamp: ${currentTimestamp}`);
          // console.log(`rateTimestamp: ${rateTimestamp.valueOf()}`);
          expect(rateValue).to.eq(
            toBn(Config.startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
          );
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
          const [rateTimestamp, rateValue, _] =
            await testRateOracle.observations(2);
          expect(rateValue).to.eq(
            toBn(Config.startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
          );
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
          const [rateTimestamp, rateValue, _] =
            await testRateOracle.observations(1);
          expect(rateValue).to.eq(
            toBn(Config.startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
          );
          expect(rateTimestamp).to.eq(currentTimestamp + 1); // TImestemp from *before* last write
        });
      });

      describe("#getRateFromTo", async () => {
        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());
        });

        it("correctly calculates rate from one timestamp to the next", async () => {
          await testRateOracle.increaseObservationCardinalityNext(4);

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          // set new liquidity index value
          await Config.setRateAsDecimal(0.1);
          await testRateOracle.writeOracleEntry();
          const rateToTimestamp = await getCurrentTimestamp(provider);

          const rateFromTo = await testRateOracle.getRateFromTo(
            rateFromTimestamp,
            rateToTimestamp
          );

          const expectedRateFromTo = toBn("0.1");

          expect(rateFromTo).to.be.closeTo(
            expectedRateFromTo,
            10_000_000_000_000
          ); // within 1e13 of 1e17 = within 0.01%
        });

        it("correctly calculates rate from one timestamp to the next when there was no recent write", async () => {
          await testRateOracle.increaseObservationCardinalityNext(4);

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          await testRateOracle.writeOracleEntry();

          await advanceTimeAndBlock(BigNumber.from(86400).mul(5), 500); // advance by 500 days
          const rateFromTimestamp = await getCurrentTimestamp(provider);
          await advanceTimeAndBlock(BigNumber.from(86400).mul(5), 500); // advance by 500 days

          // set new liquidity index value
          await Config.setRateAsDecimal(0.21);
          const rateToTimestamp = await getCurrentTimestamp(provider);

          const rateFromTo = await testRateOracle.getRateFromTo(
            rateFromTimestamp,
            rateToTimestamp
          );

          const expectedRateFromTo = toBn("0.105");
          expect(rateFromTo).to.be.closeTo(
            expectedRateFromTo,
            10_000_000_000_000
          ); // within 1e13 of 1e17 = within 0.01%
        });
      });

      describe("#getApyFromTo", async () => {
        const expectedApy = 0.31536; // This is equivalent to 1.00000001 per second for 365 days = 31536000 seconds
        let startTime: number;

        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());

          await testRateOracle.increaseObservationCardinalityNext(10);
          await Config.setRateAsDecimal(0);
          await testRateOracle.writeOracleEntry();
          startTime = await getCurrentTimestamp();

          // One year passes
          await Config.setRateAsDecimal(expectedApy);
          await setTimeNextBlock(startTime + 31536000); // One year after first reading
          await testRateOracle.writeOracleEntry();

          // Another year passes
          await Config.setRateAsDecimal(expectedApy);
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
            toBn(expectedApy), // convert rate to APY in wad
            100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
          );
        });

        it("correctly calculates APY between two known, NON-consecutive data points", async () => {
          const apy = await testRateOracle.getApyFromTo(
            startTime,
            startTime + 2 * 31536000
          );
          expect(apy).to.be.closeTo(
            toBn(expectedApy), // convert rate to APY in wad
            100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
          );
        });

        it("correctly calculates APY for intervals IN BETWEEN consecutive data points", async () => {
          const apy = await testRateOracle.getApyFromTo(
            startTime + 100000,
            startTime + 10000000
          );
          expect(apy).to.be.closeTo(
            toBn(expectedApy), // convert rate to APY in wad
            100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
          );
        });

        it("correctly calculates APY for intervals across data points", async () => {
          const apy = await testRateOracle.getApyFromTo(
            startTime + 20000000,
            startTime + 40000000
          );
          expect(apy).to.be.closeTo(
            toBn(expectedApy), // convert rate to APY in wad
            100000 // within 100k for a percentage expressed in ray = within 0.0000000001%
          );
        });
      });

      describe("#interpolateRateValue", async () => {
        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());
        });

        class InterpolateTest {
          public description: string;
          constructor(
            public startRate: number,
            public increaseFactor: number,
            public timeInSeconds: number,
            public queryTime: number,
            _description?: string
          ) {
            if (_description) {
              this.description = `: ${_description}`;
            } else {
              this.description = `(${startRate}, ${increaseFactor}, ${timeInSeconds}, ${queryTime})`;
            }
          }
        }

        const tests = [
          new InterpolateTest(1, 0.00000001, 86400, 86400),
          new InterpolateTest(1, 0.0000000001, 86400, 3600),
          new InterpolateTest(1, 0.000000000001, 86400, 60),
          new InterpolateTest(
            1,
            0.000000000000001,
            86400,
            1,
            "1 second at insanely low interest"
          ),
          new InterpolateTest(1, 1, 86400, 3600, "zero interest"),
          new InterpolateTest(1, 1, 3600, 1, "zero interest (one second)"),
          // new InterpolateTest(1, 0.9999999, 86400), // negative interest (factor < 1) not supported?
          // new InterpolateTest(1, 0.9999999, 1), // negative interest (factor < 1) not supported?
          new InterpolateTest(1, 0.000000001, 3600, 3601),
          new InterpolateTest(50, 0.000000001, 86400, 1),
          new InterpolateTest(50, 0.000000001, 86400, 86399),
          new InterpolateTest(1, 1787, 7776000, 86400, "3 months"),
          new InterpolateTest(2, 0.5, 3601, 1),
          new InterpolateTest(1, 1, 7776000, 7076000),
        ];

        tests.forEach(function (t) {
          it(`interpolateRateValue${t.description}`, async () => {
            const realizedInterpolatedRateValue =
              await testRateOracle.interpolateRateValue(
                {
                  blockTimestamp: 0,
                  observedValue: toBn(
                    t.startRate,
                    consts.NORMALIZED_RATE_DECIMALS
                  ),
                  initialized: true,
                },
                {
                  blockTimestamp: t.timeInSeconds,
                  observedValue: toBn(
                    t.startRate + t.increaseFactor,
                    consts.NORMALIZED_RATE_DECIMALS
                  ),
                  initialized: true,
                },
                t.queryTime
              );

            if (t.increaseFactor === 0) {
              expect(realizedInterpolatedRateValue).to.eq(
                toBn(t.startRate, consts.NORMALIZED_RATE_DECIMALS)
              );
            } else {
              const slopeUntilQueryTime = realizedInterpolatedRateValue
                .sub(toBn(t.startRate, consts.NORMALIZED_RATE_DECIMALS))
                .div(t.queryTime);

              expect(slopeUntilQueryTime).to.eq(
                toBn(t.increaseFactor, consts.NORMALIZED_RATE_DECIMALS).div(
                  t.timeInSeconds
                )
              );
            }
          });
        });
      });

      describe("#binarySearch", async () => {
        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());
        });

        it("binary search works as expected", async () => {
          await testRateOracle.increaseObservationCardinalityNext(4);

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          const beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          // set new liquidity index value
          await Config.setRateAsDecimal(0.1);
          const afterOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();

          const targetTimestamp = Math.floor(
            (beforeOrAtTimestamp + afterOrAtTimestamp) / 2
          );

          const [beforeOrAtRateValue, afterOrAtRateValue] =
            await testRateOracle.binarySearch(targetTimestamp);
          expect(beforeOrAtRateValue.observedValue).to.eq(
            toBn(Config.startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
          );
          expect(afterOrAtRateValue.observedValue).to.be.closeTo(
            toBn(0.1, consts.NORMALIZED_RATE_DECIMALS),
            10000
          );
        });

        // other scenarios
      });

      describe("#getSurroundingRates", async () => {
        let beforeOrAtTimestamp: number;
        let atOrAfterTimestamp: number;

        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());

          await testRateOracle.increaseObservationCardinalityNext(6);

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          beforeOrAtTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          // set new liquidity index value
          await Config.setRateAsDecimal(0.1);
          atOrAfterTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();
        });

        it("target is beforeOrAt", async () => {
          const [realizedBeforeOrAtRateValue, realizedAtOrAfterValue] =
            await testRateOracle.testGetSurroundingRates(beforeOrAtTimestamp);

          expect(realizedBeforeOrAtRateValue).to.eq(
            toBn(Config.startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
          );
          expect(realizedAtOrAfterValue).to.be.closeTo(
            toBn("0.1", consts.NORMALIZED_RATE_DECIMALS),
            1000
          );
        });

        it("target is atOrAfter", async () => {
          const [realizedBeforeOrAtRateValue, realizedAtOrAfterValue] =
            await testRateOracle.testGetSurroundingRates(atOrAfterTimestamp);

          expect(realizedBeforeOrAtRateValue).to.be.closeTo(
            toBn("0.1", consts.NORMALIZED_RATE_DECIMALS),
            1000
          );
          expect(realizedAtOrAfterValue).to.eq(0);
        });

        it("target is in the middle", async () => {
          const targetTimestamp = Math.floor(
            (beforeOrAtTimestamp + atOrAfterTimestamp) / 2
          );

          // does binary search
          const [realizedBeforeOrAtRateValue, realizedAtOrAfterValue] =
            await testRateOracle.testGetSurroundingRates(targetTimestamp);

          expect(realizedBeforeOrAtRateValue).to.eq(
            toBn(Config.startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
          );
          expect(realizedAtOrAfterValue).to.be.closeTo(
            toBn("0.1", consts.NORMALIZED_RATE_DECIMALS),
            1000
          );
        });

        it("fails if target is too old", async () => {
          const targetTimestamp = beforeOrAtTimestamp - 604800; // going back one week

          await expect(testRateOracle.testGetSurroundingRates(targetTimestamp))
            .to.be.reverted;
        });
      });

      describe("#computeApyFromRate", async () => {
        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());
        });

        it("correctly computes apy", async () => {
          const realizedApy = await testRateOracle.testComputeApyFromRate(
            toBn("0.1"),
            toBn("0.5")
          );
          const expectedApy = toBn("0.2");
          expect(realizedApy).to.be.closeTo(expectedApy, 100);
        });
      });

      describe("#variableFactor", async () => {
        let firstTimestamp: number;
        let secondTimestamp: number;

        beforeEach("deploy and initialize test oracle", async () => {
          ({ testRateOracle } = await Config.oracleFixture());

          await testRateOracle.increaseObservationCardinalityNext(10);

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          firstTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();

          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          // set new liquidity index value
          await Config.setRateAsDecimal(0.1);
          secondTimestamp = (await getCurrentTimestamp(provider)) + 1;
          await testRateOracle.writeOracleEntry();
        });

        it("calculate variable factor at maturity", async () => {
          const termStartTimestampBN = toBn(firstTimestamp.toString());
          const termEndTimestampBN = toBn(secondTimestamp.toString());
          const realizedVariableFactor =
            await testRateOracle.variableFactorNoCache(
              termStartTimestampBN,
              termEndTimestampBN
            );
          const expectedVariableFactor = toBn("0.1");
          expect(realizedVariableFactor).to.be.closeTo(
            expectedVariableFactor,
            10_000_000_000_000
          ); // within 1e13 of 1e17 = within 0.01%
        });

        it("calculate variable factor after maturity", async () => {
          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          const termStartTimestampBN = toBn(firstTimestamp.toString());
          const termEndTimestampBN = toBn(secondTimestamp.toString());
          const realizedVariableFactor =
            await testRateOracle.variableFactorNoCache(
              termStartTimestampBN,
              termEndTimestampBN
            );
          const expectedVariableFactor = toBn("0.1");
          expect(realizedVariableFactor).to.be.closeTo(
            expectedVariableFactor,
            10_000_000_000_000
          ); // within 1e13 of 1e17 = within 0.01%
        });

        it("calculates variable factor before maturity", async () => {
          await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
          await Config.setRateAsDecimal(0.2);

          const termStartTimestampBN = toBn(firstTimestamp.toString());
          const termEndTimestampBN = toBn(
            (secondTimestamp + 604800).toString()
          );

          const realizedVariableFactor =
            await testRateOracle.variableFactorNoCache(
              termStartTimestampBN,
              termEndTimestampBN
            );

          const expectedVariableFactor = toBn("0.3");
          expect(realizedVariableFactor).to.eq(expectedVariableFactor);
        });

        it("reverts if termStartTimestamp is too old", async () => {
          const termStartTimestampBN = toBn(
            (firstTimestamp - 31536000).toString()
          );
          const termEndTimestampBN = toBn(
            (secondTimestamp + 604800).toString()
          );

          await expect(
            testRateOracle.variableFactorNoCache(
              termStartTimestampBN,
              termEndTimestampBN
            )
          ).to.be.reverted;
        });
      });
    });
  }
});
