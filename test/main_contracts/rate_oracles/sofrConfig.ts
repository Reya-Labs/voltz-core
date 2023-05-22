import {
  ERC20Mock,
  MockRedstonePriceFeed,
  TestRateOracle,
} from "../../../typechain";
import { deployments, ethers } from "hardhat";

let sofrIndexValue: MockRedstonePriceFeed;
let sofrIndexEffectiveDate: MockRedstonePriceFeed;
let underlyingToken: ERC20Mock;

export const ConfigForGenericTests = {
  configName: "Redstone",
  oracleFixture: async () => {
    // Use hardhat-deploy to deploy factory and mocks
    await deployments.fixture(["Factory", "Mocks"]);

    sofrIndexValue = (await ethers.getContract(
      "MockRedstonePriceFeed1"
    )) as MockRedstonePriceFeed;

    sofrIndexEffectiveDate = (await ethers.getContract(
      "MockRedstonePriceFeed2"
    )) as MockRedstonePriceFeed;

    const ratesAndTimestamps = [
      [1.07547978, 1682510400],
      [1.07562318, 1682596800],
      [1.07576689, 1682683200],
      [1.0761981, 1682942400],
      [1.07634189, 1683028800],
      [1.0764857, 1683115200],
      [1.07662953, 1683201600],
      [1.07678086, 1683288000],
      [1.0772349, 1683547200],
    ];

    for (const rateAndTimestamp of ratesAndTimestamps) {
      sofrIndexValue.pushRate(
        ethers.utils.parseUnits(rateAndTimestamp[0].toString(), 8)
      );

      sofrIndexEffectiveDate.pushRate(rateAndTimestamp[1]);
    }

    const TestRateOracleFactory = await ethers.getContractFactory(
      "TestSofrRateOracle"
    );

    underlyingToken = (await ethers.getContract("ERC20Mock")) as ERC20Mock;

    const testRateOracle = (await TestRateOracleFactory.deploy(
      sofrIndexValue.address,
      sofrIndexEffectiveDate.address,
      underlyingToken.address
    )) as TestRateOracle;
    return {
      testRateOracle,
      sofrIndexValue,
      sofrIndexEffectiveDate,
      underlyingToken,
    };
  },
};
