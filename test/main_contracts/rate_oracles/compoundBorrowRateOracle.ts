import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./compoundBorrowConfig";
import { MockCToken, TestCompoundBorrowRateOracle } from "../../../typechain";
import { advanceTimeAndBlock } from "../../helpers/time";

const { provider } = waffle;

describe("Compound Borrow Rate Oracle", () => {
  const blocksPerYear = BigNumber.from(31536000).div(13);
  const wad = BigNumber.from(10).pow(18);
  const halfWad = BigNumber.from(10).pow(9);

  const ratePerYearInWad = BigNumber.from(2).mul(wad).div(100); // 2%
  const ratePerBlock = ratePerYearInWad.div(blocksPerYear);

  let wallet: Wallet, other: Wallet;
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>;
  let testCompoundBorrowRateOracle: TestCompoundBorrowRateOracle;
  let cToken: MockCToken;
  let lastObservedRateInWad: BigNumber;

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

    it(`Verify borrow rate in common scenario`, async () => {
      const blockNow = await provider.getBlockNumber();
      const lastUpdateBlock = await cToken.accrualBlockNumber();
      const blockDelta = BigNumber.from(blockNow).sub(lastUpdateBlock);

      const expectedRate = ratePerBlock
        .mul(blockDelta)
        .add(wad) // initial borrow index
        .mul(halfWad);

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(expectedRate);

      lastObservedRateInWad = rate.div(halfWad);
    });

    it(`Verify borrow rate blockDelta is 0`, async () => {
      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(lastObservedRateInWad.mul(halfWad));
    });

    it(`Verify borrow rate when blockDelta is 1`, async () => {
      const blockNow = await provider.getBlockNumber();
      await cToken.setAccrualBlockNumber(blockNow);

      const expectedRate = ratePerBlock // block delta is 1 so no need for .mul(blockDelta)
        .mul(wad) // index remains the same
        .div(wad) // scale back to wad
        .add(wad)
        .mul(halfWad); // scale to ray

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(expectedRate);

      lastObservedRateInWad = rate.div(halfWad);
    });

    it(`Verify borrow rate after index update`, async () => {
      await cToken.setBorrowIndex(lastObservedRateInWad);

      const blockNow = await provider.getBlockNumber();
      await cToken.setAccrualBlockNumber(blockNow - 3);
      const blockDelta = BigNumber.from(4); // 1 block diff

      const expectedRate = ratePerBlock
        .mul(blockDelta) // block delta is 1 so no need for .mul(blockDelta)
        .mul(lastObservedRateInWad) // index remains the same
        .div(wad) // scale back to wad
        .add(lastObservedRateInWad)
        .mul(halfWad); // scale to ray

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();
      expect(rate).to.eq(expectedRate);
    });

    it(`Verify borrow rate when blockDelta is bigger`, async () => {
      await advanceTimeAndBlock(BigNumber.from(86400), 1220); // advance by one day
      const blockNow = await provider.getBlockNumber();
      await cToken.setAccrualBlockNumber(blockNow - 1220);

      const blockDelta = BigNumber.from(1220);

      const expectedRate = ratePerBlock
        .mul(blockDelta) // block delta is 1 so no need for .mul(blockDelta)
        .mul(lastObservedRateInWad) // index remains the same
        .div(wad) // scale back to wad
        .add(lastObservedRateInWad)
        .mul(halfWad); // scale to ray

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.be.closeTo(expectedRate, BigNumber.from(10).pow(14));
    });

    it(`Failed rate update when rate per block is too high`, async () => {
      await cToken.setBorrowRatePerBlock(ratePerBlock.mul(halfWad)); // by 1e9

      await expect(testCompoundBorrowRateOracle.getLastUpdatedRate()).to.be
        .reverted;
    });
  });
});
