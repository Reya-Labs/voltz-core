import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { MockStEth } from "../../../typechain/MockStEth";
import { expect } from "chai";
import { TestLidoRateOracle } from "../../../typechain/TestLidoRateOracle";
import { ConfigForGenericTests as Config } from "./lidoConfig";
import { toBn } from "evm-bn";
import { consts } from "../../helpers/constants";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";

const { provider } = waffle;

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
        if (rate.lt(BigNumber.from(10).pow(27))) {
          expect(observedRate).to.eq(BigNumber.from(10).pow(27));
        } else {
          expect(observedRate).to.eq(rate);
        }
      });
    }

    it(`scenario`, async () => {
      await testLidoRateOracle.increaseObservationCardinalityNext(100);

      await testLidoRateOracle.writeOracleEntry();

      for (let i = 0; i < 5; i++) {
        console.log(await testLidoRateOracle.getRate(i));
      }

      const timestamp_1 = toBn(
        ((await getCurrentTimestamp(provider)) + 1).toString()
      );
      await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 2);

      const rate_2 = toBn((1.1).toString(), 27);
      const timestamp_2 = toBn(
        ((await getCurrentTimestamp(provider)) + 1).toString()
      );

      await mockStEth.setSharesMultiplierInRay(rate_2);
      await testLidoRateOracle.writeOracleEntry();

      const observedRate = await testLidoRateOracle.getLatestRateValue();

      expect(observedRate).to.eq(rate_2);

      expect(await testLidoRateOracle.getCurrentRateInRay()).to.eq(
        toBn((1.105).toString(), 27)
      );

      for (let i = 0; i < 5; i++) {
        console.log(await testLidoRateOracle.getRate(i));
      }

      const realizedVariableFactor =
        await testLidoRateOracle.variableFactorNoCache(
          timestamp_1,
          timestamp_2
        );

      console.log(realizedVariableFactor.toString());

      await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 2);

      const rate_3 = toBn((1.1).toString(), 27).add(BigNumber.from(10).pow(12));

      await mockStEth.setSharesMultiplierInRay(rate_3);
      await testLidoRateOracle.writeOracleEntry();

      for (let i = 0; i < 5; i++) {
        console.log(await testLidoRateOracle.getRate(i));
      }
    });
  });
});
