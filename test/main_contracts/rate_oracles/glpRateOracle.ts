import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import {
  TestGlpRateOracle,
  GlpOracleDependencies,
} from "../../../typechain";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./glpConfig";

const GLP_PRECISION = BigNumber.from("1000000000000000000000000000000");
const WAD_PRECISION = BigNumber.from("1000000000000000000");

describe("Aave Borrow Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let mockGlpDependencies: GlpOracleDependencies;
  let testGlpRateOracle: TestGlpRateOracle;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Aave V3 Lend specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle, glpDependencies } =
        await loadFixture(Config.oracleFixture);
      mockGlpDependencies = glpDependencies;
      testGlpRateOracle = testRateOracle as unknown as TestGlpRateOracle;
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
        const previousRate = GLP_PRECISION.div(1000);
        const previousGlpEthPrice = ethers.utils.parseUnits("2", 30);

        const scaledReward = ethers.utils.parseUnits(
          rate.reward.toString(),
          18
        );
        const scaledAum = ethers.utils.parseUnits(rate.aum.toString(), 30);
        await mockGlpDependencies.setAum(scaledAum);
        await mockGlpDependencies.setCumulativeRewardPerToken(scaledReward);

        await testGlpRateOracle.writeOracleEntry();
        const observeRate = await testGlpRateOracle.getLatestRateValue();

        ethers.utils.parseUnits(rate.aum.toString(), 30);
        const expected = previousRate
          .mul(
            GLP_PRECISION.add(
              scaledReward.mul(previousGlpEthPrice).div(WAD_PRECISION)
            )
          )
          .div(GLP_PRECISION);

        expect(observeRate).to.eq(expected);
      });
    }
  });
});
