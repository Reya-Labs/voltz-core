import { MockLidoOracle, MockWETH, TestRateOracle } from "../../../typechain";
import { deployments, ethers } from "hardhat";
import { toBn } from "../../helpers/toBn";
import { consts } from "../../helpers/constants";
import { MockStEth } from "../../../typechain/MockStEth";

let stEth: MockStEth;
let lidoOracle: MockLidoOracle;
let weth: MockWETH;
let startingExchangeRate = 1;

export const ConfigForGenericTests = {
  configName: "Lido",
  startingExchangeRate,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    // store stEth for use when setting rates
    stEth = (await ethers.getContract("MockStEth")) as MockStEth;
    lidoOracle = (await ethers.getContract("MockLidoOracle")) as MockLidoOracle;
    weth = (await ethers.getContract("MockWETH")) as MockWETH;
    await stEth.setSharesMultiplierInRay(
      toBn(startingExchangeRate, consts.NORMALIZED_RATE_DECIMALS)
    );

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestLidoRateOracle"
    );

    const testRateOracle = (await TestRateOracleFactory.deploy(
      stEth.address,
      lidoOracle.address,
      weth.address
    )) as TestRateOracle;
    return { testRateOracle, stEth };
  },
  setRateAsDecimal: async (rate: number) => {
    // To set the rate for Lido, we call setSharesMultiplierInRay on the stEth pool
    // The decimal value is scaled up by 10^27
    await stEth.setSharesMultiplierInRay(
      toBn(rate, consts.NORMALIZED_RATE_DECIMALS)
    );
    // We also want to set the timestamp to the current timestamp
  },
};
