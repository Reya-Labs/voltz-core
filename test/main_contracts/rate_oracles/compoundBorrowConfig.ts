import {
  // MockAaveLendingPool,
  MockCToken,
  TestRateOracle,
  MockCInterestRateModel,
} from "../../../typechain";
import { toBn } from "../../helpers/toBn";
import { deployments, ethers } from "hardhat";

let cToken: MockCToken;
const startingExchangeRate = 1;

export const ConfigForGenericTests = {
  configName: "CompoundBorrow",
  startingExchangeRate,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);
    const token = await ethers.getContract("ERC20Mock");

    // store the cToken and interest rate model and some rate per block info for use when setting rates
    cToken = (await ethers.getContract("MockCToken")) as MockCToken;
    const mockCInterestRateModel = (await ethers.getContract(
      "MockCInterestRateModel"
    )) as MockCInterestRateModel;

    // Set rate per block in IR model -> 1%
    const blocksPerYear = 31536000 / 13;
    const ratePerBlock = toBn(0.02, 18).div(toBn(blocksPerYear));
    await mockCInterestRateModel.setBorrowRatePerBlock(ratePerBlock);

    // set interest rate model in ctoken
    await cToken.setInterestRateModel(mockCInterestRateModel.address);

    // set initial borrow index
    await cToken.setBorrowIndex(toBn(startingExchangeRate, 18));

    const testRateOracleFactory = await ethers.getContractFactory(
      "TestCompoundBorrowRateOracle"
    );
    // We deploy our own rate oracle (rather than using hardhat-depoy) because we want a *Test*RateOracle which opens up some private state
    const testRateOracle = (await testRateOracleFactory.deploy(
      cToken.address,
      false,
      token.address,
      await token.decimals()
    )) as TestRateOracle;
    return { testRateOracle };
  },
  setRateAsDecimal: async (rate: number) => {
    // To set the rate for compound, we call setExchangeRate on the cToken
    await cToken.setBorrowIndex(toBn(rate, 18));
  },
};
