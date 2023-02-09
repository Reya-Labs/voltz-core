import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import {
  TestGlpRateOracle,
  GlpOracleDependencies,
  ERC20Mock,
} from "../../../typechain";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./glpConfig";

describe("Aave Borrow Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let mockGlpDependencies: GlpOracleDependencies;
  let testGlpRateOracle: TestGlpRateOracle;
  let token: ERC20Mock;
  let lastTimestamp: number;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Aave V3 Lend specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle, glpDependencies, underlyingToken, timestamp } =
        await loadFixture(Config.oracleFixture);
      mockGlpDependencies = glpDependencies;
      token = underlyingToken;
      testGlpRateOracle = testRateOracle as unknown as TestGlpRateOracle;
      lastTimestamp = timestamp;
    });
    it("Verify correct protocol ID for Aave Borrow rate oracle", async () => {
      const protocolID =
        await testGlpRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(8);
    });

    const sampleRates = [
      { aum: 100, reward: 1 },
      { aum: 123, reward: 123 },
      { aum: 1, reward: 123 },
      { aum: 408387899, reward: 0.01 },
    ];

    for (const rate of sampleRates) {
      it(`Verify rate conversion (${rate})`, async () => {
        const previousRate = BigNumber.from("1000000000000000000000000000");

        const price = await mockGlpDependencies.getMinPrice(token.address); // 10

        const scaledReward = ethers.utils.parseUnits(
          rate.reward.toString(),
          18
        );
        const scaledAum = ethers.utils.parseUnits(rate.aum.toString(), 30);
        await mockGlpDependencies.setAum(scaledAum);
        await mockGlpDependencies.setTokensPerInterval(scaledReward);

        await testGlpRateOracle.writeOracleEntry();
        const observeRate = await testGlpRateOracle.getLatestRateValue();

        const currentBlock = await ethers.provider.getBlock("latest");
        ethers.utils.parseUnits(rate.aum.toString(), 30);
        const expected = previousRate
          .mul(
            scaledReward
              .mul(price)
              .mul(currentBlock.timestamp - lastTimestamp)
              .div(scaledAum)
          )
          .div(BigNumber.from("1000000000000000000")); // div 1e18

        expect(observeRate).to.eq(expected);
      });
    }
  });
});
