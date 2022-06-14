import { TestRateOracle } from "../../../typechain";
import { deployments, ethers } from "hardhat";
import { toBn } from "../../helpers/toBn";
import { consts } from "../../helpers/constants";
import { MockStEth } from "../../../typechain/MockStEth";

let stEth: MockStEth;

export const ConfigForGenericTests = {
  configName: "Lido",
  startingExchangeRate: 1,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    // store stEth for use when setting rates
    stEth = (await ethers.getContract("MockStEth")) as MockStEth;

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestLidoRateOracle"
    );

    const testRateOracle = (await TestRateOracleFactory.deploy(
      stEth.address
    )) as TestRateOracle;
    return { testRateOracle, stEth };
  },
  setRateAsDecimal: async (rate: number) => {
    // To set the rate for Aave, we call setReserveNormalizedIncome on the lending pool
    // The decimal value is scaled up by 10^27
    await stEth.setSharesMultiplierInRay(
      toBn(rate, consts.NORMALIZED_RATE_DECIMALS)
    );
  },
};
