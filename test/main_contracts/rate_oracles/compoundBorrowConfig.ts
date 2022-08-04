import { MockCToken, TestRateOracle } from "../../../typechain";
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

    // Set inital rate per block to 0
    await cToken.setBorrowRatePerBlock(0);

    // set initial borrow index
    await cToken.setBorrowIndex(toBn(startingExchangeRate, 18));

    // set last update block
    const latestBlock = await ethers.provider.getBlock("latest");
    await cToken.setAccrualBlockNumber(latestBlock.number);

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
    await cToken.setBorrowIndex(toBn(rate, 18));
  },
};
