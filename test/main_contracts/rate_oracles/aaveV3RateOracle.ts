import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { MockAaveV3LendingPool } from "../../../typechain/MockAaveV3LendingPool";
import { expect } from "chai";
import { TestAaveBorrowRateOracle } from "../../../typechain/TestAaveBorrowRateOracle";
// import { toBn } from "../../helpers/toBn";
import { ConfigForGenericTests as Config } from "./aavev3Config";
import {
  ERC20Mock,
  // TestRateOracle,
  //   TestRateOracle__factory,
} from "../../../typechain";
// import { advanceTimeAndBlock } from "../../helpers/time";

// const { provider } = waffle;

describe("Aave Borrow Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let mockAaveLendingPool: MockAaveV3LendingPool;
  let testAaveBorrowRateOracle: TestAaveBorrowRateOracle;
  let token: ERC20Mock;
  // let writeBlocks: number[];
  // let updateBlocks: number[];

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Aave Borrow specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle, aaveLendingPool, underlyingToken } =
        await loadFixture(Config.oracleFixture);
      mockAaveLendingPool = aaveLendingPool;
      token = underlyingToken;
      testAaveBorrowRateOracle =
        testRateOracle as unknown as TestAaveBorrowRateOracle;
    });
    it("Verify correct protocol ID for Aave Borrow rate oracle", async () => {
      const protocolID =
        await testAaveBorrowRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(5);
    });

    const sampleRates = [
      1,
      123,
      "1000004208637548525088396290",
      BigNumber.from(10).pow(32),
    ];

    for (const rate of sampleRates) {
      it(`Verify rate conversion (${rate})`, async () => {
        /* Rates set for Aave are already in Ray and should
        remain unchaged in the rate oracle buffer
        */
        await mockAaveLendingPool.setReserveNormalizedIncome(
          token.address,
          rate
        );
        await testAaveBorrowRateOracle.writeOracleEntry();
        const observeRate = await testAaveBorrowRateOracle.getLatestRateValue();

        const rateBN = BigNumber.from(rate);

        const increaseInRate = (BigNumber.from(10).pow(27)).add(rateBN.div(31557600));
        const expectedRate = increaseInRate.mul(rateBN).div(BigNumber.from(10).pow(27));

        expect(observeRate).to.eq(expectedRate);
      });
    }
  });
});
