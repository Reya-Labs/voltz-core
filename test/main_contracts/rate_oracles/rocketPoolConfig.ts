import { MockWETH, TestRateOracle } from "../../../typechain";
import { deployments, ethers } from "hardhat";
import { toBn } from "../../helpers/toBn";
import { consts } from "../../helpers/constants";
import { MockRocketEth } from "../../../typechain/MockRocketEth";
import { MockRocketNetworkBalances } from "../../../typechain/MockRocketNetworkBalances";

let rocketEth: MockRocketEth;
let rocketNetworkBalances: MockRocketNetworkBalances;
let weth: MockWETH;

export const ConfigForGenericTests = {
  configName: "RocketPool",
  startingExchangeRate: 1,
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    // store rocketEth for use when setting rates
    rocketEth = (await ethers.getContract("MockRocketEth")) as MockRocketEth;
    await rocketEth.setInstantUpdates(true);
    await rocketEth.setRethMultiplierInRay(
      toBn(1, consts.NORMALIZED_RATE_DECIMALS)
    );

    weth = (await ethers.getContract("MockWETH")) as MockWETH;
    rocketNetworkBalances = (await ethers.getContract(
      "MockRocketNetworkBalances"
    )) as MockRocketNetworkBalances;

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestRocketPoolRateOracle"
    );

    const testRateOracle = (await TestRateOracleFactory.deploy(
      rocketEth.address,
      rocketNetworkBalances.address,
      weth.address
    )) as TestRateOracle;

    return { testRateOracle, rocketEth: rocketEth };
  },
  setRateAsDecimal: async (rate: number) => {
    // To set the rate for Aave, we call setReserveNormalizedIncome on the lending pool
    // The decimal value is scaled up by 10^27
    await rocketEth.setRethMultiplierInRay(
      toBn(rate, consts.NORMALIZED_RATE_DECIMALS)
    );
  },
};
