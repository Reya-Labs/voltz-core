import {
  // MockAaveLendingPool,
  MockCToken,
  TestRateOracle,
} from "../../../typechain";
import { toBn } from "../../helpers/toBn";
import { deployments, ethers } from "hardhat";

let cToken: MockCToken;
let rateDecimals: number;

export const ConfigForGenericTests = {
  configName: "Compound",
  startingExchangeRate: 0.02,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);
    const token = await ethers.getContract("ERC20Mock");

    // store the cToken and some decimals info for use when setting rates
    cToken = (await ethers.getContract("MockCToken")) as MockCToken;
    // Compound rates are expressed as integers by multiplying them by 10 ^ (18 + underlyingDecimals - cTokenDecimals)
    //  = 10 ^ (18 + underlyingDecimals - 8)
    rateDecimals = 18 + (await token.decimals()) - 8;

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestCompoundRateOracle"
    );
    // We deploy our own rate oracle (rather than using hardhat-depoy) because we want a *Test*RateOracle which opens up some private state
    const testRateOracle = (await TestRateOracleFactory.deploy(
      cToken.address,
      false,
      token.address,
      await token.decimals()
    )) as TestRateOracle;
    return { testRateOracle };
  },
  setRateAsDecimal: async (rate: number) => {
    // To set the rate for compound, we call setExchangeRate on the cToken
    await cToken.setExchangeRate(toBn(rate, rateDecimals));
  },
};
