import { BigNumber, Wallet } from "ethers";
import { ethers, network, waffle } from "hardhat";
import { expect } from "chai";
import { fixedFactor } from "../../shared/utilities";
import { toBn } from "evm-bn";
import { div, sub, mul, add } from "../../shared/functions";
import { consts } from "../../helpers/constants";
import { TestRateOracle } from "../../../typechain/TestRateOracle";
import { MockAaveLendingPool } from "../../../typechain/MockAaveLendingPool";
import {
  rateOracleFixture,
  timeFixture,
  fixedAndVariableMathFixture,
  mockERC20Fixture,
  mockAaveLendingPoolFixture,
} from "../../shared/fixtures";
import { getCurrentTimestamp } from "../../helpers/time";

const { provider } = waffle;

describe("Aave Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  const initializedOracleFixture = async () => {
    const { time } = await timeFixture();
    const { fixedAndVariableMath } = await fixedAndVariableMathFixture(time);
    const { token } = await mockERC20Fixture();
    const { aaveLendingPool } = await mockAaveLendingPoolFixture();
    console.log(
      "Test TS: Aave lending pool address is: ",
      aaveLendingPool.address
    );
    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      toBn("1.0")
    );
    console.log(
      "Test TS: Aave normalized income is: ",
      await aaveLendingPool.getReserveNormalizedIncome(token.address)
    );
    const { testRateOracle } = await rateOracleFixture(
      fixedAndVariableMath.address,
      time.address,
      token.address,
      aaveLendingPool.address
    );

    await testRateOracle.initializeTestRateOracle({
      tick: 0,
      liquidity: 0,
    });

    return testRateOracle;
  };

  describe("#initialize", () => {
    let testRateOracle: TestRateOracle;
    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
      // await testRateOracle.initializeTestRateOracle({
      //   tick: 1,
      //   liquidity: 1
      // });
    });

    it("aave lending pool set correctly", async () => {
      const normalizedIncome =
        await testRateOracle.testGetReserveNormalizedIncome();
      expect(normalizedIncome).to.eq(toBn("1.0"));
    });

    it("rateIndex, rateCardinality, rateCardinalityNext correctly initialized", async () => {
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(1);
    });
  });

  describe("#grow", () => {
    let testRateOracle: TestRateOracle;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
      // await testRateOracle.initializeTestRateOracle({
      //   tick: 1,
      //   liquidity: 1
      // });
    });

    it("increases the cardinality next for the first call", async () => {
      await testRateOracle.testGrow(5);
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(5);
    });

    it("is no op if oracle is already gte that size", async () => {
      await testRateOracle.testGrow(5);
      await testRateOracle.testGrow(3);
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      expect(rateCardinality).to.eq(1);
      expect(rateCardinalityNext).to.eq(5);
    });
  });

  describe("#write", () => {
    let testRateOracle: TestRateOracle;

    beforeEach("deploy and initialize test oracle", async () => {
      testRateOracle = await loadFixture(initializedOracleFixture);
    });

    it("single element array gets overwritten", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);
      await testRateOracle.update();
      const [rateIndex, rateCardinality, rateCardinalityNext] =
        await testRateOracle.getOracleVars();
      expect(rateIndex).to.eq(0);
      const [rateTimestamp, rateValue] = await testRateOracle.getRate(0);
      console.log(currentTimestamp);
      console.log(rateTimestamp);
      expect(rateValue).to.eq(toBn("1.0"));
      expect(rateTimestamp).to.eq(toBn((currentTimestamp + 1).toString()));
    });
  });
});
