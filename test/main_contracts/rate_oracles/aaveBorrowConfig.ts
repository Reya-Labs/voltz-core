import {
  ERC20Mock,
  MockAaveLendingPool,
  TestRateOracle,
} from "../../../typechain";
import { toBn } from "../../helpers/toBn";
import { deployments, ethers } from "hardhat";
import { consts } from "../../helpers/constants";

let aaveLendingPool: MockAaveLendingPool;
let underlyingToken: ERC20Mock;

export const ConfigForGenericTests = {
  configName: "AaveBorrow",
  startingExchangeRate: 1,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    // store the aaveLendingPool and token for use when setting rates
    aaveLendingPool = (await ethers.getContract(
      "MockAaveLendingPool"
    )) as MockAaveLendingPool;
    underlyingToken = (await ethers.getContract("ERC20Mock")) as ERC20Mock;

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestAaveBorrowRateOracle"
    );

    await aaveLendingPool.setReserveNormalizedVariableDebt(
      underlyingToken.address,
      toBn(1, consts.AAVE_RATE_DECIMALS)
    );
    const testRateOracle = (await TestRateOracleFactory.deploy(
      aaveLendingPool.address,
      underlyingToken.address
    )) as TestRateOracle;
    return { testRateOracle };
  },
  setRateAsDecimal: async (rate: number) => {
    // To set the rate for Aave, we call setReserveNormalizedVariableDebt on the lending pool
    // The decimal value is scaled up by 10^27
    await aaveLendingPool.setReserveNormalizedVariableDebt(
      underlyingToken.address,
      toBn(rate, consts.AAVE_RATE_DECIMALS)
    );
  },
};
