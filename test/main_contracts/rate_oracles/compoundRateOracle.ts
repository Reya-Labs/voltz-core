import { BigNumber, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import { toBn } from "../../helpers/toBn";
import { TestCompoundRateOracle } from "../../../typechain/TestCompoundRateOracle";
import {
  compoundRateOracleTestFixture,
  mockERC20Fixture,
  mockCTokenFixture,
} from "../../shared/fixtures";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
import { MockCToken } from "../../../typechain";

const { provider } = waffle;

let cToken: MockCToken;
let testCompoundRateOracle: TestCompoundRateOracle;

describe("Compound Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });
  const oracleFixture = async () => {
    const { token: _token } = await mockERC20Fixture();
    const { mockCToken: _cToken } = await mockCTokenFixture(_token.address);
    const { compoundRateOracleTest } = await compoundRateOracleTestFixture(
      _cToken.address,
      _token.address
    );
    await compoundRateOracleTest.setMinSecondsSinceLastUpdate(0); // test without caching by default
    return {
      testCompoundRateOracle: compoundRateOracleTest,
      token: _token,
      cToken: _cToken,
    };
  };
  describe("#getRateFromTo", async () => {
    beforeEach("deploy and initialize test oracle", async () => {
      ({ testCompoundRateOracle, cToken } = await loadFixture(oracleFixture));
    });
    it("correctly calculates rate from one timestamp to the next", async () => {
      await testCompoundRateOracle.increaseObservationCardinalityNext(4);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testCompoundRateOracle.writeOracleEntry();

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      await cToken.setExchangeRate(toBn("0.1"));
      const rateToTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testCompoundRateOracle.writeOracleEntry();
      expect(rateFromTimestamp).not.to.eq(rateToTimestamp); // debug

      await testCompoundRateOracle.testGetRateFromTo(
        rateFromTimestamp,
        rateToTimestamp
      );
      const rateFromTo = await testCompoundRateOracle.latestRateFromTo();

      const expectedRateFromTo = toBn("0.1");

      expect(rateFromTo).to.eq(expectedRateFromTo);
    });
  });
});
