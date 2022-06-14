import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { MockRocketEth } from "../../../typechain/MockRocketEth";
import { expect } from "chai";
import { TestRocketPoolRateOracle } from "../../../typechain/TestRocketPoolRateOracle";
import { ConfigForGenericTests as Config } from "./rocketPoolConfig";

describe(`RocketPool Rate Oracle`, () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let testRocketPoolRateOracle: TestRocketPoolRateOracle;
  let mockRocketEth: MockRocketEth;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("RocketPool-specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      // let genericRateOracle: TestRateOracle;
      const { testRateOracle, rocketEth } = await loadFixture(
        Config.oracleFixture
      );
      testRocketPoolRateOracle =
        testRateOracle as unknown as TestRocketPoolRateOracle;
      mockRocketEth = rocketEth;
    });

    it("protocol ID", async () => {
      const protocolId =
        await testRocketPoolRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();
      expect(protocolId).to.eq(4);
    });

    const sampleRates = [
      1,
      123,
      "123456789012345678901234567890",
      BigNumber.from(10).pow(50),
    ];

    for (const rate of sampleRates) {
      it(`rate conversion (${rate})`, async () => {
        // Rates set for RocketPool are already expressied in Ray and should appear unchanged in the rate oracle
        await mockRocketEth.setRethMultiplierInRay(rate);
        await testRocketPoolRateOracle.writeOracleEntry();
        const observedRate =
          await testRocketPoolRateOracle.getLatestRateValue();
        expect(observedRate).to.eq(BigNumber.from(rate));
      });
    }
  });
});
