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
    // Starting exchange rate = 0.02, expressed using 10 ^ (18 + underlyingDecimals - cTokenDecimals)
    //  = 0.02 * 10 ^ (18 + 18 - 8)
    //  = 0.02 * 10 ^ 28
    //  = 2 * 10^26
    await _cToken.setExchangeRate(BigNumber.from(10).pow(26).mul(2));
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

      // Starting exchange rate = 0.02, expressed using 10 ^ (18 + underlyingDecimals - cTokenDecimals)
      //  = 0.02 * 10 ^ (18 + 18 - 8)
      //  = 0.02 * 10 ^ 28
      //  = 2 * 10^26
      let exchangeRate = BigNumber.from(10).pow(26).mul(2);
      await cToken.setExchangeRate(exchangeRate);

      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
      // Increase exchange rate by 0.1%
      exchangeRate = exchangeRate.mul(1001).div(1000);
      await cToken.setExchangeRate(exchangeRate);
      const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testCompoundRateOracle.writeOracleEntry();
      await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day

      // Increase exchange rate by 0.1%
      exchangeRate = exchangeRate.mul(1001).div(1000);
      await cToken.setExchangeRate(exchangeRate);
      const rateToTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await testCompoundRateOracle.writeOracleEntry();
      expect(rateFromTimestamp).not.to.eq(rateToTimestamp); // debug
      const rateFromTo = await testCompoundRateOracle.getRateFromTo(
        rateFromTimestamp,
        rateToTimestamp
      );
      const expectedRateFromTo = toBn(0.001); // 0.1%

      expect(rateFromTo).to.eq(expectedRateFromTo);
    });
  });
});
