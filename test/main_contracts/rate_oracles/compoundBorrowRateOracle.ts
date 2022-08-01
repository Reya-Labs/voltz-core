import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./compoundBorrowConfig";
import { MockCToken, TestCompoundBorrowRateOracle } from "../../../typechain";

const { provider } = waffle;

describe("Compound Borrow Rate Oracle", () => {
  const blocksPerYear = BigNumber.from(31536000).div(13);
  const wad = BigNumber.from(10).pow(18);
  const ratePerYearInWad = BigNumber.from(2).mul(wad).div(100); // 2%
  const ratePerBlock = ratePerYearInWad.div(blocksPerYear);

  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let testCompoundBorrowRateOracle: TestCompoundBorrowRateOracle;
  let cToken: MockCToken;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = waffle.createFixtureLoader([wallet, other]);
  });

  describe("Compound Borrow specific behaviour", () => {
    beforeEach("deploy and initialize test oracle", async () => {
      const { testRateOracle } = await loadFixture(Config.oracleFixture);
      testCompoundBorrowRateOracle =
        testRateOracle as unknown as TestCompoundBorrowRateOracle;
      cToken = (await ethers.getContract("MockCToken")) as MockCToken;

      await cToken.setBorrowRatePerBlock(ratePerBlock);
    });
    it("Verify correct protocol ID for Compound Borrow rate oracle", async () => {
      const protocolID =
        await testCompoundBorrowRateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      expect(protocolID).to.eq(6);
    });

    it(`Verify rate for Compound Borrow`, async () => {
      const blockNow = await provider.getBlockNumber();
      const lastUpdateBlock = await cToken.accrualBlockNumber();
      const blockDelta = BigNumber.from(blockNow).sub(lastUpdateBlock);

      const expectedRate = ratePerBlock
        .mul(blockDelta)
        .add(wad) // initial borrow index
        .mul(BigNumber.from(10).pow(9));

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(expectedRate);
    });
  });
});
