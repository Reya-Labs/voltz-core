import { deployments, ethers, waffle } from "hardhat";
import { BigNumber } from "ethers";
import { MockRocketEth } from "../../../typechain/MockRocketEth";
import { expect } from "chai";
import { TestRocketPoolRateOracle } from "../../../typechain/TestRocketPoolRateOracle";
import { toBn } from "../../helpers/toBn";
import {
  MockRocketNetworkBalances,
  MockWETH,
  TestRateOracle,
} from "../../../typechain";
import { advanceTimeAndBlock } from "../../helpers/time";

const { provider } = waffle;

describe(`RocketPool Rate Oracle`, () => {
  let testRocketPoolRateOracle: TestRocketPoolRateOracle;
  let mockRocketEth: MockRocketEth;
  let writeBlocks: number[];
  let updateBlocks: number[];

  describe("RocketPool-specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      // Use hardhat-deploy to deploy factory and mocks
      await deployments.fixture(["Factory", "Mocks"]);
      updateBlocks = [];
      writeBlocks = [];

      // store rocketEth for use when setting rates
      const rocketEth = (await ethers.getContract(
        "MockRocketEth"
      )) as MockRocketEth;
      await rocketEth.setInstantUpdates(false);
      {
        const transaction = await rocketEth.setRethMultiplierInRay(toBn(1, 27));
        updateBlocks.push(transaction.blockNumber || 0);
      }

      const weth = (await ethers.getContract("MockWETH")) as MockWETH;
      const rocketNetworkBalances = (await ethers.getContract(
        "MockRocketNetworkBalances"
      )) as MockRocketNetworkBalances;

      const TestRateOracleFactory = await ethers.getContractFactory(
        "TestRocketPoolRateOracle"
      );

      const testRateOracle = (await TestRateOracleFactory.deploy(
        rocketEth.address,
        rocketNetworkBalances.address,
        weth.address
      )) as TestRateOracle;
      writeBlocks.push(testRateOracle.deployTransaction.blockNumber || 0);

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

    const getRateSlope = async () => {
      const rateSlope = await testRocketPoolRateOracle.getRateSlope();
      return (
        rateSlope.rateChange.div(BigNumber.from(10).pow(18)).toNumber() /
        1e9 /
        rateSlope.timeChange
      );
    };

    const getBlockSlope = async () => {
      const blockSlope = await testRocketPoolRateOracle.getBlockSlope();
      return blockSlope.timeChange / blockSlope.blockChange.toNumber();
    };

    // eslint-disable-next-line no-unused-vars
    const writeOracleInfo = async () => {
      const [rateIndex, rateCardinality] =
        await testRocketPoolRateOracle.oracleVars();

      console.log("ORACLE INFO:");
      console.log("update blocks:", updateBlocks);
      console.log("write blocks:", writeBlocks);

      console.log("average block time:", await getBlockSlope());

      const lastUpdatedRate =
        await testRocketPoolRateOracle.getLastUpdatedRate();
      console.log(
        "last updated rate:",
        "t:",
        lastUpdatedRate.timestamp.toString(),
        "rate:",
        lastUpdatedRate.resultRay.toString()
      );

      try {
        console.log("rate slope:", await getRateSlope());
        const currentRate =
          await testRocketPoolRateOracle.getCurrentRateInRay();
        console.log("current rate:", "rate:", currentRate.toString());
      } catch (_) {
        console.log("rate slope:", "not enough points to compute rate slope");
        console.log("current rate:", "not enough points to compute rate slope");
      }

      console.log(
        "current index/cardinality:",
        rateIndex,
        "/",
        rateCardinality
      );
      for (let i = 0; i < rateCardinality; i++) {
        const [rateTimestamp, rateValue, initialized] =
          await testRocketPoolRateOracle.observations(i);
        console.log(
          "t:",
          rateTimestamp.toString(),
          "rate:",
          rateValue.toString(),
          "init:",
          initialized.toString()
        );
      }
      console.log();
    };

    it("timestamp of first write", async () => {
      await testRocketPoolRateOracle.setMinSecondsSinceLastUpdate(64800);
      const [rateTimestamp, rateValue, _] =
        await testRocketPoolRateOracle.observations(0);

      // await writeOracleInfo();
      expect(rateValue).to.eq(toBn(1, 27));

      expect(rateTimestamp).to.eq(
        (await provider.getBlock(writeBlocks[0])).timestamp -
          Math.floor(13.5 * (writeBlocks[0] - updateBlocks[0]))
      );
    });

    it("second write after 1 day", async () => {
      await testRocketPoolRateOracle.setMinSecondsSinceLastUpdate(64800);
      await testRocketPoolRateOracle.increaseObservationCardinalityNext(2);
      await advanceTimeAndBlock(BigNumber.from(86400 - 5760), 5760);
      {
        const transaction = await mockRocketEth.setRethMultiplierInRay(
          toBn(1.0001, 27)
        );
        updateBlocks.push(transaction.blockNumber || 0);
      }

      expect(await getBlockSlope()).to.be.closeTo(15, 0.01);

      {
        const transaction = await testRocketPoolRateOracle.writeOracleEntry();
        writeBlocks.push(transaction.blockNumber || 0);
      }

      // await writeOracleInfo();

      expect(await getRateSlope()).to.be.closeTo(1 / 86400 / 1e4, 1e-8);

      const [rateTimestamp, rateValue, _] =
        await testRocketPoolRateOracle.observations(1);

      expect(rateValue).to.eq(toBn(1.0001, 27));

      expect(rateTimestamp).to.eq(
        (await provider.getBlock(writeBlocks[1])).timestamp -
          Math.floor(
            (((await provider.getBlock(updateBlocks[1])).timestamp -
              (await provider.getBlock(updateBlocks[0])).timestamp) *
              (writeBlocks[1] - updateBlocks[1])) /
              (updateBlocks[1] - updateBlocks[0])
          )
      );
    });

    it("second write after 2 days", async () => {
      await testRocketPoolRateOracle.setMinSecondsSinceLastUpdate(64800);
      await testRocketPoolRateOracle.increaseObservationCardinalityNext(2);
      await advanceTimeAndBlock(BigNumber.from(2 * 86400 - 2 * 5760), 2 * 5760);
      {
        const transaction = await mockRocketEth.setRethMultiplierInRay(
          toBn(1.0001, 27)
        );
        updateBlocks.push(transaction.blockNumber || 0);
      }

      expect(await getBlockSlope()).to.be.closeTo(15, 0.01);

      {
        const transaction = await testRocketPoolRateOracle.writeOracleEntry();
        writeBlocks.push(transaction.blockNumber || 0);
      }

      // await writeOracleInfo();

      expect(await getRateSlope()).to.be.closeTo(1 / (2 * 86400) / 1e4, 1e-8);

      const [rateTimestamp, rateValue, _] =
        await testRocketPoolRateOracle.observations(1);

      expect(rateValue).to.eq(toBn(1.0001, 27));

      expect(rateTimestamp).to.eq(
        (await provider.getBlock(writeBlocks[1])).timestamp -
          Math.floor(
            (((await provider.getBlock(updateBlocks[1])).timestamp -
              (await provider.getBlock(updateBlocks[0])).timestamp) *
              (writeBlocks[1] - updateBlocks[1])) /
              (updateBlocks[1] - updateBlocks[0])
          )
      );
    });

    it("second update after 2 days", async () => {
      await testRocketPoolRateOracle.setMinSecondsSinceLastUpdate(64800);
      await testRocketPoolRateOracle.increaseObservationCardinalityNext(3);
      await advanceTimeAndBlock(BigNumber.from(86400 - 5760), 5760);

      expect(await getBlockSlope()).to.be.closeTo(15, 0.01);

      // await writeOracleInfo();

      await testRocketPoolRateOracle.writeOracleEntry();

      {
        const [rateIndex] = await testRocketPoolRateOracle.oracleVars();

        // await writeOracleInfo();

        expect(rateIndex).to.eq(0);
      }

      await advanceTimeAndBlock(BigNumber.from(86400 - 5760), 5760);

      {
        const transaction = await mockRocketEth.setRethMultiplierInRay(
          toBn(1.0001, 27)
        );
        updateBlocks.push(transaction.blockNumber || 0);
      }

      {
        const transaction = await testRocketPoolRateOracle.writeOracleEntry();
        writeBlocks.push(transaction.blockNumber || 0);
      }

      {
        const [rateIndex] = await testRocketPoolRateOracle.oracleVars();

        // await writeOracleInfo();

        expect(rateIndex).to.eq(1);
      }

      const [rateTimestamp, rateValue, _] =
        await testRocketPoolRateOracle.observations(1);

      expect(rateValue).to.eq(toBn(1.0001, 27));

      expect(rateTimestamp).to.eq(
        (await provider.getBlock(writeBlocks[1])).timestamp -
          Math.floor(
            (((await provider.getBlock(updateBlocks[1])).timestamp -
              (await provider.getBlock(updateBlocks[0])).timestamp) *
              (writeBlocks[1] - updateBlocks[1])) /
              (updateBlocks[1] - updateBlocks[0])
          )
      );
    });

    it("more updates", async () => {
      await testRocketPoolRateOracle.setMinSecondsSinceLastUpdate(64800);
      await testRocketPoolRateOracle.increaseObservationCardinalityNext(3);
      await advanceTimeAndBlock(BigNumber.from(86400 - 5760), 5760);

      expect(await getBlockSlope()).to.be.closeTo(15, 0.01);

      // await writeOracleInfo();

      await testRocketPoolRateOracle.writeOracleEntry();

      {
        const [rateIndex] = await testRocketPoolRateOracle.oracleVars();

        // await writeOracleInfo();

        expect(rateIndex).to.eq(0);
      }

      await advanceTimeAndBlock(BigNumber.from(86400 - 5760), 5760);

      {
        const transaction = await mockRocketEth.setRethMultiplierInRay(
          toBn(1.0001, 27)
        );
        updateBlocks.push(transaction.blockNumber || 0);
      }

      {
        const transaction = await testRocketPoolRateOracle.writeOracleEntry();
        writeBlocks.push(transaction.blockNumber || 0);
      }

      {
        const [rateIndex] = await testRocketPoolRateOracle.oracleVars();

        // await writeOracleInfo();

        expect(rateIndex).to.eq(1);
      }

      const [rateTimestamp, rateValue, _] =
        await testRocketPoolRateOracle.observations(1);

      expect(rateValue).to.eq(toBn(1.0001, 27));

      expect(rateTimestamp).to.eq(
        (await provider.getBlock(writeBlocks[1])).timestamp -
          Math.floor(
            (((await provider.getBlock(updateBlocks[1])).timestamp -
              (await provider.getBlock(updateBlocks[0])).timestamp) *
              (writeBlocks[1] - updateBlocks[1])) /
              (updateBlocks[1] - updateBlocks[0])
          )
      );
    });
  });
});
