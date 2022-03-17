import { BigNumber, Wallet } from "ethers";
import { ethers, waffle, deployments } from "hardhat";
import { expect } from "chai";
import { toBn } from "../../helpers/toBn";
import { div, sub, add, pow } from "../../shared/functions";
import { TestCompoundRateOracle } from "../../../typechain/TestCompoundRateOracle";
import {
  compoundRateOracleTestFixture,
  mockERC20Fixture,
  mockCTokenFixture,
} from "../../shared/fixtures";
import {
  advanceTime,
  advanceTimeAndBlock,
  getCurrentTimestamp,
  setTimeNextBlock,
} from "../../helpers/time";
import Decimal from "decimal.js-light";
import { ERC20Mock, MockCToken } from "../../../typechain";
// import { MockCToken } from "../../../typechain/MockCToken";

// import { consts } from "../../helpers/constants";
// import { ICToken } from
// import Compound from '@compound-finance/compound-js';
// var compound = new Compound();

const { provider } = waffle;

let token: ERC20Mock;
let cToken: MockCToken;
let testCompoundRateOracle: TestCompoundRateOracle;

describe("Compound Rate Oracle", () => {

  // it("gets cDAI exchange rate", async () => {
  //   let cDAI =
  // });

  // let wallet: Wallet, other: Wallet;
  // let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;

  // before("create fixture loader", async () => {
  //   [wallet, other] = await (ethers as any).getSigners();
  //   loadFixture = waffle.createFixtureLoader([wallet, other]);
  // });

  // const oracleFixture = async () => {
  //   const { token: _token } = await mockERC20Fixture();

  //   await _compoundLendingPool.setReserveNormalizedIncome(
  //     _token.address,
  //     toBn("1.0", consts.COMPOUND_RATE_DECIMALS) // should be in ray
  //   );

  //   const { compoundRateOracleTest } = await compoundRateOracleTestFixture(
  //     _compoundLendingPool.address,
  //     _token.address
  //   );

  //   await compoundRateOracleTest.setMinSecondsSinceLastUpdate(0); // test without caching by default
  //   return {
  //     testCompoundRateOracle: compoundRateOracleTest,
  //     token: _token,
  //     compoundLendingPool: _compoundLendingPool,
  //   };
  // };

  // describe("#initialize", () => {
  //   beforeEach("deploy and initialize test oracle", async () => {
  //     // ({ testCompoundRateOracle } = await loadFixture(oracleFixture));
  //     await deployments.fixture(["Factory", "Mocks", "RateOracles"]);
  //     testCompoundRateOracle = (await ethers.getContract(
  //       "TestCompoundRateOracle"
  //     )) as TestCompoundRateOracle;
  //   });

  //   it("rateIndex, rateCardinality, rateCardinalityNext correctly initialized", async () => {
  //     const [rateIndex, rateCardinality, rateCardinalityNext] =
  //       await testCompoundRateOracle.getOracleVars();
  //     expect(rateIndex).to.eq(0);
  //     expect(rateCardinality).to.eq(1);
  //     expect(rateCardinalityNext).to.eq(1);
  //   });
  // });

  // describe("#getRateFromTo", async () => {
  //   beforeEach("deploy and initialize test oracle", async () => {
  //     ({ testCompoundRateOracle, token, compoundLendingPool } =
  //       await loadFixture(oracleFixture));
  //   });

  //   it("correctly calculates rate from one timestamp to the next", async () => {
  //     await testCompoundRateOracle.increaseObservarionCardinalityNext(4);

  //     await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
  //     const rateFromTimestamp = (await getCurrentTimestamp(provider)) + 1;
  //     await testCompoundRateOracle.writeOracleEntry();

  //     await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
  //     // set new liquidity index value
  //     await compoundLendingPool.setReserveNormalizedIncome(
  //       token.address,
  //       toBn("1.1", consts.COMPOUND_RATE_DECIMALS)
  //     );
  //     const rateToTimestamp = (await getCurrentTimestamp(provider)) + 1;
  //     await testCompoundRateOracle.writeOracleEntry();

  //     await testCompoundRateOracle.testGetRateFromTo(
  //       rateFromTimestamp,
  //       rateToTimestamp
  //     );
  //     const rateFromTo = await testCompoundRateOracle.latestRateFromTo();

  //     const expectedRateFromTo = toBn("0.1");

  //     expect(rateFromTo).to.eq(expectedRateFromTo);
  //   });
  // });

});
