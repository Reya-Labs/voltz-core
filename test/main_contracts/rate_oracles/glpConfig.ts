import {
  ERC20Mock,
  GlpOracleDependencies,
  TestGlpRateOracle,
} from "../../../typechain";
import { deployments, ethers } from "hardhat";
import { BigNumber } from "ethers";

const GLP_PRECISION = BigNumber.from("1000000000000000000000000000000");
const WAD_PRECISION = BigNumber.from("1000000000000000000");

let glpDependencies: GlpOracleDependencies;
let underlyingToken: ERC20Mock;
let testGlpRateOracle: TestGlpRateOracle;

type FixtureParams = {
  minEthPrice: BigNumber;
  maxEthPrice: BigNumber;
  minAum: BigNumber;
  maxAum: BigNumber;
  supply: BigNumber;
  cummulativeReward: BigNumber;
};

const defaultParams: FixtureParams = {
  minEthPrice: BigNumber.from(1558).mul(GLP_PRECISION),
  maxEthPrice: BigNumber.from(1590).mul(GLP_PRECISION),
  minAum: BigNumber.from(400000000).mul(GLP_PRECISION),
  maxAum: BigNumber.from(500000000).mul(GLP_PRECISION),
  supply: BigNumber.from(450000000).mul(WAD_PRECISION),
  cummulativeReward: BigNumber.from(0),
};

export const ConfigForGenericTests = {
  configName: "Glp",
  startingExchangeRate: 0,
  oracleFixture: async (p?: FixtureParams) => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    const params = p ?? defaultParams;

    // store the aaveLendingPool and token for use when setting rates
    glpDependencies = (await ethers.getContract(
      "GlpOracleDependencies"
    )) as GlpOracleDependencies;
    underlyingToken = (await ethers.getContract("ERC20Mock")) as ERC20Mock;

    // set token
    await glpDependencies.setRewardToken(underlyingToken.address);

    // ethGlpPrice price
    const latestPrice = params.minEthPrice
      .add(params.maxEthPrice)
      .mul(GLP_PRECISION)
      .div(
        params.minAum.add(params.maxAum).mul(WAD_PRECISION).div(params.supply)
      );

    const testRateOracleFactory = await ethers.getContractFactory(
      "TestGlpRateOracle"
    );

    // calculate initial rate based on given ethPrice & cumm
    const rewardsRateSinceLastUpdate = params.cummulativeReward
      .mul(latestPrice)
      .div(GLP_PRECISION); // GLP PRECISION
    const initialRateRay = rewardsRateSinceLastUpdate.div(1000);

    const currentBlock = await ethers.provider.getBlock("latest");
    const rateOracle = await testRateOracleFactory.deploy(
      glpDependencies.address,
      underlyingToken.address,
      [currentBlock.timestamp],
      [initialRateRay], // 1e27
      latestPrice, // lastethGlpPrice
      params.cummulativeReward // lastCumulativeRewardPerToken (1)
    );
    testGlpRateOracle = rateOracle as TestGlpRateOracle;

    // set initial data
    await glpDependencies.setCumulativeRewardPerToken(params.cummulativeReward);
    await glpDependencies.setEthPrice(params.minEthPrice, false);
    await glpDependencies.setEthPrice(params.maxEthPrice, true);
    await glpDependencies.setAum(params.minAum, false);
    await glpDependencies.setAum(params.maxAum, true);
    await glpDependencies.setTotalSupply(params.supply);
    return {
      testRateOracle: testGlpRateOracle,
      glpDependencies,
      latestPrice,
      lastRate: initialRateRay,
    };
  },
  setRateAsDecimal: async (rewardsSinceLastUpdate: number) => {
    // get last cumm & last price
    const lastPrice = await testGlpRateOracle.lastEthPriceInGlp();
    const lastReward = await testGlpRateOracle.lastCumulativeRewardPerToken();
    const scaledNewlyRetreivedRate = ethers.utils.parseUnits(
      rewardsSinceLastUpdate.toString(),
      30
    );
    const cumulativeRewardPerToken = scaledNewlyRetreivedRate
      .mul(GLP_PRECISION)
      .div(lastPrice)
      .add(lastReward);
    await glpDependencies.setCumulativeRewardPerToken(cumulativeRewardPerToken);
  },
};
