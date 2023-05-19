import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./redstoneConfig";
import { MockRedstonePriceFeed, TestSofrRateOracle } from "../../../typechain";
import { advanceTimeAndBlock } from "../../helpers/time";

const { provider } = waffle;

describe("Sofr Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let priceFeed: MockRedstonePriceFeed;
  let testSofrRateOracle: TestSofrRateOracle;

  const pow18 = BigNumber.from(10).pow(18);
  const pow19 = BigNumber.from(10).pow(19);

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Sofr specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle, sofrIndex } = await loadFixture(
        Config.oracleFixture
      );
      testSofrRateOracle = testRateOracle as unknown as TestSofrRateOracle;
      priceFeed = sofrIndex;
    });

    it("Verify correct protocol ID for Sofr rate oracle", async () => {
      const protocolID =
        await testSofrRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(10);
    });

    it("Verify rate", async () => {
      const rateInfo = await testSofrRateOracle.getLastUpdatedRate();
      expect(rateInfo.timestamp).to.be.eq(1682510400);
      expect(rateInfo.resultRay).to.be.eq(BigNumber.from(107547978).mul(pow19));
      await priceFeed.advanceIndex();
    });

    it("rate of return", async () => {
      const rateOfReturn = await testSofrRateOracle.exposedGetRateOfReturn(
        BigNumber.from(107576689).mul(pow19),
        BigNumber.from(107662953).mul(pow19)
      );

      expect(
        parseFloat(ethers.utils.formatUnits(rateOfReturn, 27))
      ).to.be.closeTo(0.000801, 0.000001);
    });

    it("apy from rate of return", async () => {
      const apy = await testSofrRateOracle.exposedComputeApyFromRate(
        await testSofrRateOracle.exposedGetRateOfReturn(
          BigNumber.from(107576689).mul(pow19),
          BigNumber.from(107662953).mul(pow19)
        ),
        BigNumber.from(6).mul(pow18).div(365)
      );

      expect(parseFloat(ethers.utils.formatUnits(apy, 27))).to.be.closeTo(
        0.0481,
        0.0001
      );
    });

    it("interpolate rate value", async () => {
      {
        const interpolatedRate = await testSofrRateOracle.interpolateRateValue(
          BigNumber.from(107576689).mul(pow19),
          BigNumber.from(481).mul(BigNumber.from(10).pow(14)),
          BigNumber.from(518400).mul(pow18)
        );

        expect(
          parseFloat(ethers.utils.formatUnits(interpolatedRate, 27))
        ).to.be.closeTo(1.07662953, 0.000001);
      }

      {
        const interpolatedRate = await testSofrRateOracle.interpolateRateValue(
          BigNumber.from(107648570).mul(pow19),
          BigNumber.from(481).mul(BigNumber.from(10).pow(14)),
          BigNumber.from(86400).mul(pow18)
        );

        expect(
          parseFloat(ethers.utils.formatUnits(interpolatedRate, 27))
        ).to.be.closeTo(1.07662953, 0.00000001);
      }
    });

    it("apy from to", async () => {
      await testSofrRateOracle.increaseObservationCardinalityNext(16);
      while (true) {
        await testSofrRateOracle.writeOracleEntry();
        if ((await priceFeed.canAdvanceIndex()) === false) {
          break;
        }
        await priceFeed.advanceIndex();
      }

      const currentBlock = await provider.getBlock("latest");
      await advanceTimeAndBlock(
        BigNumber.from(1692472134 - currentBlock.timestamp),
        1
      );
      const apy = await testSofrRateOracle.getApyFrom(1683201600);

      expect(parseFloat(ethers.utils.formatUnits(apy, 18))).to.be.closeTo(
        0.0506,
        0.00003
      );
    });

    it("apy from to (2)", async () => {
      await testSofrRateOracle.increaseObservationCardinalityNext(16);
      while (true) {
        await testSofrRateOracle.writeOracleEntry();
        if ((await priceFeed.canAdvanceIndex()) === false) {
          break;
        }
        await priceFeed.advanceIndex();
      }

      const currentBlock = await provider.getBlock("latest");
      await advanceTimeAndBlock(
        BigNumber.from(1683633600 - currentBlock.timestamp),
        1
      );
      const apy = await testSofrRateOracle.getApyFrom(1683547200);

      expect(parseFloat(ethers.utils.formatUnits(apy, 18))).to.be.closeTo(
        0.0506,
        0.00001
      );
    });
  });
});
