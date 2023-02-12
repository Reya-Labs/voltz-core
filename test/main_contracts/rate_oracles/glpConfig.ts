import {
  ERC20Mock,
  GlpOracleDependencies,
  TestRateOracle,
} from "../../../typechain";
import { deployments, ethers } from "hardhat";
import { BigNumber } from "ethers";

const GLP_PRECISION = BigNumber.from("1000000000000000000000000000000");
const WAD_PRECISION = BigNumber.from("1000000000000000000");

let glpDependencies: GlpOracleDependencies;
let underlyingToken: ERC20Mock;

type FixtureParams = {
  minEthPrice: BigNumber;
  maxEthPrice: BigNumber;
  minAum: BigNumber;
  maxAum: BigNumber;
  supply: BigNumber;
  cummulativeReward: BigNumber;
};

export const ConfigForGenericTests = {
  configName: "Glp",
  startingExchangeRate: 1,
  oracleFixture: async (params: FixtureParams) => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

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
      .div(GLP_PRECISION);
    const initialRate = GLP_PRECISION.div(1000)
      .mul(GLP_PRECISION.add(rewardsRateSinceLastUpdate))
      .div(GLP_PRECISION);

    const currentBlock = await ethers.provider.getBlock("latest");
    const testRateOracle = (await testRateOracleFactory.deploy(
      glpDependencies.address,
      underlyingToken.address,
      [currentBlock.timestamp],
      [initialRate], // 1e27
      latestPrice, // lastethGlpPrice
      params.cummulativeReward // lastCumulativeRewardPerToken (1)
    )) as TestRateOracle;
    return {
      testRateOracle,
      glpDependencies,
      latestPrice,
      lastRate: initialRate,
    };
  },
  setRateAsDecimal: async (rate: number) => {
    // The decimal value is scaled up by 10^27
    await glpDependencies.setCumulativeRewardPerToken(
      ethers.utils.parseUnits(rate.toString(), 18)
    );
  },
};
