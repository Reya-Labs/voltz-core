import {
  ERC20Mock,
  GlpOracleDependencies,
  TestRateOracle,
} from "../../../typechain";
import { deployments, ethers } from "hardhat";

let glpDependencies: GlpOracleDependencies;
let underlyingToken: ERC20Mock;

export const ConfigForGenericTests = {
  configName: "Glp",
  startingExchangeRate: 1,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    // store the aaveLendingPool and token for use when setting rates
    glpDependencies = (await ethers.getContract(
      "GlpOracleDependencies"
    )) as GlpOracleDependencies;
    underlyingToken = (await ethers.getContract("ERC20Mock")) as ERC20Mock;

    // set token
    await glpDependencies.setRewardToken(underlyingToken.address);
    // set price
    await glpDependencies.setEthPrice(ethers.utils.parseUnits("10", 30));
    await glpDependencies.setGlpPrice(ethers.utils.parseUnits("5", 30));
    // set tokens per interval
    await glpDependencies.setCumulativeRewardPerToken(
      ethers.utils.parseUnits("100", 18)
    );
    // set AUM
    await glpDependencies.setAum(ethers.utils.parseUnits("100", 30));

    const testRateOracleFactory = await ethers.getContractFactory(
      "TestGlpRateOracle"
    );

    const currentBlock = await ethers.provider.getBlock("latest");
    const testRateOracle = (await testRateOracleFactory.deploy(
      glpDependencies.address,
      underlyingToken.address,
      [currentBlock.timestamp],
      ["1000000000000000000000000000"], // 1e27
      ethers.utils.parseUnits("2", 30), // lastethGlpPrice
      "0" // lastCumulativeRewardPerToken (1)
    )) as TestRateOracle;
    return {
      testRateOracle,
      glpDependencies,
      underlyingToken,
      timestamp: currentBlock.timestamp,
    };
  },
  setRateAsDecimal: async (rate: number) => {
    // The decimal value is scaled up by 10^27
    await glpDependencies.setCumulativeRewardPerToken(
      ethers.utils.parseUnits(rate.toString(), 18)
    );
  },
};
