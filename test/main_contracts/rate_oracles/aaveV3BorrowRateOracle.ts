import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { MockAaveV3LendingPool } from "../../../typechain/MockAaveV3LendingPool";
import { expect } from "chai";
import { TestAaveV3BorrowRateOracle } from "../../../typechain/TestAaveV3BorrowRateOracle";
import { ConfigForGenericTests as Config } from "./aaveV3BorrowConfig";
import { ERC20Mock } from "../../../typechain";

describe("Aave v3 Borrow Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let mockAaveLendingPool: MockAaveV3LendingPool;
  let testAaveBorrowRateOracle: TestAaveV3BorrowRateOracle;
  let token: ERC20Mock;

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
        testRateOracle as unknown as TestAaveV3BorrowRateOracle;
    });
    it("Verify correct protocol ID for Aave v3 Borrow rate oracle", async () => {
      const protocolID =
        await testAaveBorrowRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(9);
    });

    const sampleRates = [
      1,
      123,
      "314159265358979323846264338327",
      BigNumber.from(10).pow(50),
    ];

    for (const rate of sampleRates) {
      it(`Verify rate conversion (${rate})`, async () => {
        /* Rates set for Aave are already in Ray and should
        remain unchaged in the rate oracle buffer
        */
        await mockAaveLendingPool.setReserveNormalizedVariableDebt(
          token.address,
          rate
        );
        await testAaveBorrowRateOracle.writeOracleEntry();
        const observeRate = await testAaveBorrowRateOracle.getLatestRateValue();

        expect(observeRate).to.eq(BigNumber.from(rate));
      });
    }
  });
});
