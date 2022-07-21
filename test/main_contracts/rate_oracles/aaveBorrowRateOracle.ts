import { ethers, waffle } from "hardhat";
import { Wallet } from "ethers";
// import { MockAaveLendingPool } from "../../../typechain/MockAaveLendingPool";
import { expect } from "chai";
import { TestAaveBorrowRateOracle } from "../../../typechain/TestAaveBorrowRateOracle";
// import { toBn } from "../../helpers/toBn";
import { ConfigForGenericTests as Config } from "./aaveBorrowConfig";
import // ERC20Mock,
// TestRateOracle,
//   TestRateOracle__factory,
"../../../typechain";
// import { advanceTimeAndBlock } from "../../helpers/time";

// const { provider } = waffle;

describe("Aave Borrow Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  // let mockAaveLendingPool: MockAaveLendingPool;
  let testAaveBorrowRateOracle: TestAaveBorrowRateOracle;
  // let token: ERC20Mock;
  // let writeBlocks: number[];
  // let updateBlocks: number[];

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Aave Borrow specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle } = await loadFixture(Config.oracleFixture);
      testAaveBorrowRateOracle =
        testRateOracle as unknown as TestAaveBorrowRateOracle;
    });
    it("Verify correct protocol ID for Aave Borrow rate oracle", async () => {
      const protocolID =
        await testAaveBorrowRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(5);
    });

    // const sampleRates = [
    //   1,
    //   123,
    //   "314159265358979323846264338327",
    //   BigNumber.from(10).pow(50),
    // ];

    // for (const rate of sampleRates) {
    //   it(`Verify rate conversion (${rate})`, async () => {
    //     /* Rates set for Aave are already in Ray and should
    //     remain unchaged in the rate oracle buffer
    //     */
    //     await mockAaveLendingPool.setFactorPerSecondInRay(token.address, rate);
    //     await testAaveBorrowRateOracle.writeOracleEntry();
    //     const observeRate = await testAaveBorrowRateOracle.getLatestRateValue();

    //     expect(observeRate).to.eq(BigNumber.from(rate));
    //   });
    // }
  });
});
