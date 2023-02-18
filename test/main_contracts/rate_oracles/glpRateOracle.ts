import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  TestGlpRateOracle,
  GlpOracleDependencies,
  ERC20Mock,
} from "../../../typechain";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./glpConfig";

const GLP_PRECISION = BigNumber.from("1000000000000000000000000000000");
const WAD_PRECISION = BigNumber.from("1000000000000000000");

describe("Aave Borrow Rate Oracle", () => {
  let mockGlpDependencies: GlpOracleDependencies;
  let testGlpRateOracle: TestGlpRateOracle;

  describe("Aave V3 Lend specific behaviour", () => {
    it("Verify correct protocol ID for Aave Borrow rate oracle", async () => {
      const { testRateOracle, glpDependencies } = await Config.oracleFixture({
        minEthPrice: GLP_PRECISION,
        maxEthPrice: GLP_PRECISION,
        minAum: GLP_PRECISION,
        maxAum: GLP_PRECISION,
        supply: GLP_PRECISION,
        cummulativeReward: BigNumber.from(1),
      });
      mockGlpDependencies = glpDependencies;
      testGlpRateOracle = testRateOracle as unknown as TestGlpRateOracle;
      const protocolID =
        await testGlpRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(8);
    });

    it("Cannot initate oracle with no historical points", async () => {
      const glpDependencies = (await ethers.getContract(
        "GlpOracleDependencies"
      )) as GlpOracleDependencies;
      const underlyingToken = (await ethers.getContract(
        "ERC20Mock"
      )) as ERC20Mock;
      const testRateOracleFactory = await ethers.getContractFactory(
        "TestGlpRateOracle"
      );
      await expect(
        testRateOracleFactory.deploy(
          glpDependencies.address,
          underlyingToken.address,
          [],
          [], // 1e27
          GLP_PRECISION,
          GLP_PRECISION
        )
      ).to.revertedWith("No initial observations");
    });

    it("Cannot initate oracle with price 0", async () => {
      const glpDependencies = (await ethers.getContract(
        "GlpOracleDependencies"
      )) as GlpOracleDependencies;
      const underlyingToken = (await ethers.getContract(
        "ERC20Mock"
      )) as ERC20Mock;
      const testRateOracleFactory = await ethers.getContractFactory(
        "TestGlpRateOracle"
      );
      await expect(
        testRateOracleFactory.deploy(
          glpDependencies.address,
          underlyingToken.address,
          [178368],
          [GLP_PRECISION], // 1e27
          BigNumber.from(0),
          GLP_PRECISION
        )
      ).to.revertedWith("Price cannot be 0");
    });

    it("Failes when reward index decreases", async () => {
      const prev = {
        minEthPrice: BigNumber.from(1558).mul(GLP_PRECISION),
        maxEthPrice: BigNumber.from(1590).mul(GLP_PRECISION),
        minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
        maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
        supply: BigNumber.from(450000000).mul(GLP_PRECISION),
        cummulativeReward: BigNumber.from(30276237),
      };
      const { testRateOracle, glpDependencies } = await Config.oracleFixture({
        minEthPrice: prev.minEthPrice,
        maxEthPrice: prev.maxEthPrice,
        minAum: prev.minAum,
        maxAum: prev.maxAum,
        supply: prev.supply,
        cummulativeReward: prev.cummulativeReward,
      });
      mockGlpDependencies = glpDependencies;
      testGlpRateOracle = testRateOracle as unknown as TestGlpRateOracle;

      // set current price & reward
      await mockGlpDependencies.setCumulativeRewardPerToken(
        prev.cummulativeReward.sub(1)
      );

      await expect(testGlpRateOracle.writeOracleEntry()).to.be.reverted;
    });

    const sampleRates = [
      {
        description: "realistic",
        prev: {
          minEthPrice: BigNumber.from(1558).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(1590).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(450000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(30276237000), // last rate = 1e27*(1+prevCum*ethGlp);
        },
        current: {
          minEthPrice: BigNumber.from(1658).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(1660).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(400000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(37276237000),
          expectedRewardsSinceLastUpdate: BigNumber.from(11018000000000),
        },
        next: {
          expectedLastPrice: BigNumber.from(
            "1474666666666666666666666666666666"
          ),
          cummulativeReward: BigNumber.from(39276237000),
          expectedRewardsSinceLastUpdate: BigNumber.from(2949333333000),
        },
      },
      {
        description: "high to low prices",
        prev: {
          minEthPrice: BigNumber.from(1658).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(1660).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(450000000).mul(WAD_PRECISION), // => old Price = 1659
          cummulativeReward: BigNumber.from(30276237000), // last rate = 1e27*(1+prevCum*ethGlp);
        },
        current: {
          minEthPrice: BigNumber.from(16).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(17).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(600000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(37276237000),
          expectedRewardsSinceLastUpdate: BigNumber.from(11613000000000),
        },
        next: {
          expectedLastPrice: BigNumber.from(22).mul(GLP_PRECISION),
          cummulativeReward: BigNumber.from(89276237000),
          expectedRewardsSinceLastUpdate: BigNumber.from(1144000000000),
        },
      },
      {
        description: "low to high prices",
        prev: {
          minEthPrice: BigNumber.from(18).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(19).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(450000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(30276237000), // last rate = 1e27*(1+prevCum*ethGlp);
        },
        current: {
          minEthPrice: BigNumber.from(7658).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(7660).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(100000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(37276237000),
          expectedRewardsSinceLastUpdate: BigNumber.from(129500000000),
        },
        next: {
          expectedLastPrice: BigNumber.from(1702).mul(GLP_PRECISION),
          cummulativeReward: BigNumber.from(37276238000),
          expectedRewardsSinceLastUpdate: BigNumber.from(1702000),
        },
      },
      {
        description: "no change in reward",
        prev: {
          minEthPrice: BigNumber.from(1558).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(1590).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(450000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(30276237000), // last rate = 1e27*(1+prevCum*ethGlp);
        },
        current: {
          minEthPrice: BigNumber.from(1658).mul(GLP_PRECISION),
          maxEthPrice: BigNumber.from(1660).mul(GLP_PRECISION),
          minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
          maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
          supply: BigNumber.from(400000000).mul(WAD_PRECISION),
          cummulativeReward: BigNumber.from(30276237000),
          expectedRewardsSinceLastUpdate: BigNumber.from(0),
        },
        next: {
          expectedLastPrice: BigNumber.from(
            "1474666666666666666666666666666666"
          ),
          cummulativeReward: BigNumber.from(30276238000),
          expectedRewardsSinceLastUpdate: BigNumber.from(1474666),
        },
      },
    ];

    for (const s of sampleRates) {
      it(`Verify rate conversion: (${s.description})`, async () => {
        const { testRateOracle, glpDependencies, lastRate } =
          await Config.oracleFixture(s.prev);
        mockGlpDependencies = glpDependencies;
        testGlpRateOracle = testRateOracle as unknown as TestGlpRateOracle;
        await testRateOracle.setMinSecondsSinceLastUpdate(1);
        await testRateOracle.increaseObservationCardinalityNext(20);

        // set current price & reward
        await mockGlpDependencies.setCumulativeRewardPerToken(
          s.current.cummulativeReward
        );
        await mockGlpDependencies.setEthPrice(s.current.minEthPrice, false);
        await mockGlpDependencies.setEthPrice(s.current.maxEthPrice, true);
        await mockGlpDependencies.setAum(s.current.minAum, false);
        await mockGlpDependencies.setAum(s.current.maxAum, true);
        await mockGlpDependencies.setTotalSupply(s.current.supply);

        // write new rate
        await testGlpRateOracle.writeOracleEntry();
        const observeRate = await testGlpRateOracle.getLatestRateValue();

        // CHECK RATE
        {
          const expected = lastRate.add(
            s.current.expectedRewardsSinceLastUpdate.div(1000)
          );

          expect(observeRate).to.eq(expected);
        }

        // CHECK LAST PRICE AFTER WRITE
        {
          const expected = s.next.expectedLastPrice;
          const price = await testGlpRateOracle.lastEthPriceInGlp();
          const reward = await testGlpRateOracle.lastCumulativeRewardPerToken();
          expect(reward).to.eq(s.current.cummulativeReward);
          expect(price).to.be.closeTo(expected, 100);
        }

        // CHECK 3rd OBSERVATION
        {
          // write new rate
          await mockGlpDependencies.setCumulativeRewardPerToken(
            s.next.cummulativeReward
          );
          await testGlpRateOracle.writeOracleEntry();
          const nextObserveRate = await testGlpRateOracle.getLatestRateValue();
          const expected = observeRate.add(
            s.next.expectedRewardsSinceLastUpdate.div(1000)
          );

          expect(nextObserveRate).to.be.eq(expected);
        }
      });
    }
  });
});
