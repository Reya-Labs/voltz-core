import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { MockStEth } from "../../../typechain/MockStEth";
import { expect } from "chai";
import { TestLidoRateOracle } from "../../../typechain/TestLidoRateOracle";
import { ConfigForGenericTests as Config } from "./lidoConfig";

describe(`Lido Rate Oracle`, () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let testLidoRateOracle: TestLidoRateOracle;
  let mockStEth: MockStEth;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Lido-specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      // let genericRateOracle: TestRateOracle;
      const { testRateOracle, stEth } = await loadFixture(Config.oracleFixture);
      testLidoRateOracle = testRateOracle as unknown as TestLidoRateOracle;
      mockStEth = stEth;
    });

    it("protocol ID", async () => {
      const protocolId =
        await testLidoRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();
      expect(protocolId).to.eq(3);
    });

    const sampleRates = [
      BigNumber.from("1"),
      BigNumber.from("123"),
      BigNumber.from("123456789012345678901234567890"),
      BigNumber.from(10).pow(50),
    ];

    for (const rate of sampleRates) {
      it(`rate conversion (${rate})`, async () => {
        // Rates set for Lido are already expressied in Ray and should appear unchanged in the rate oracle
        await mockStEth.setSharesMultiplierInRay(rate);
        await testLidoRateOracle.writeOracleEntry();
        const observedRate = await testLidoRateOracle.getLatestRateValue();
        expect(observedRate).to.eq(
          BigNumber.from(rate.add(BigNumber.from(10).pow(24).mul(5)))
        );
      });
    }
  });
});
