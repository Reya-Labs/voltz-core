import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { MockAaveV3LendingPool } from "../../../typechain/MockAaveV3LendingPool";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./aavev3Config";
import { ERC20Mock, TestAaveV3RateOracle } from "../../../typechain";

describe("Aave v3 Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let mockAaveLendingPool: MockAaveV3LendingPool;
  let testAaveV3RateOracle: TestAaveV3RateOracle;
  let token: ERC20Mock;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Aave V3 Lend specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle, aaveLendingPool, underlyingToken } =
        await loadFixture(Config.oracleFixture);
      mockAaveLendingPool = aaveLendingPool;
      token = underlyingToken;
      testAaveV3RateOracle = testRateOracle as unknown as TestAaveV3RateOracle;
    });
    it("Verify correct protocol ID for Aave Borrow rate oracle", async () => {
      const protocolID =
        await testAaveV3RateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(7);
    });

    const sampleRates = [
      1,
      123,
      "1000004208637548525088396290",
      BigNumber.from(10).pow(32),
    ];

    for (const rate of sampleRates) {
      it(`Verify rate conversion (${rate})`, async () => {
        /* Rates set for Aave are already in Ray and should
        remain unchaged in the rate oracle buffer
        */
        await mockAaveLendingPool.setReserveNormalizedIncome(
          token.address,
          rate
        );
        await testAaveV3RateOracle.writeOracleEntry();
        const observeRate = await testAaveV3RateOracle.getLatestRateValue();

        expect(observeRate).to.eq(rate);
      });
    }
  });
});
