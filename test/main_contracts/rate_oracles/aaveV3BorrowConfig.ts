import {
  ERC20Mock,
  MockAaveV3LendingPool,
  TestRateOracle,
} from "../../../typechain";
import { toBn } from "../../helpers/toBn";
import { deployments, ethers } from "hardhat";
import { consts } from "../../helpers/constants";

let aaveLendingPool: MockAaveV3LendingPool;
let underlyingToken: ERC20Mock;

export const ConfigForGenericTests = {
  configName: "AaveV3Borrow",
  startingExchangeRate: 1,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    // store the aaveLendingPool and token for use when setting rates
    aaveLendingPool = (await ethers.getContract(
      "MockAaveV3LendingPool"
    )) as MockAaveV3LendingPool;
    underlyingToken = (await ethers.getContract("ERC20Mock")) as ERC20Mock;

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestAaveV3BorrowRateOracle"
    );

    await aaveLendingPool.setReserveNormalizedVariableDebt(
      underlyingToken.address,
      toBn(1, consts.AAVE_RATE_DECIMALS)
    );
    const testRateOracle = (await TestRateOracleFactory.deploy(
      aaveLendingPool.address,
      underlyingToken.address
    )) as TestRateOracle;
    return { testRateOracle, aaveLendingPool, underlyingToken };
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
