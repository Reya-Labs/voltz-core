import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { expect } from "chai";
import { ConfigForGenericTests as Config } from "./compoundBorrowConfig";
import { MockCToken, TestCompoundBorrowRateOracle } from "../../../typechain";
import { advanceTimeAndBlock } from "../../helpers/time";

const { provider } = waffle;

const wad = BigNumber.from(10).pow(18);
const semiWad = BigNumber.from(10).pow(9);

function computeExpectedRate(
  ratePerBlock: BigNumber,
  blockDelta: BigNumber,
  ratePrior: BigNumber
) {
  return ratePerBlock
    .mul(blockDelta)
    .mul(ratePrior)
    .div(wad) // scale back to wad
    .add(ratePrior)
    .mul(semiWad); // scale to ray
}

// precision of 2 decimal (e.g 2.45%)
function calculateRatePerBlockFromAPY(apy: number) {
  const blocksPerYear = BigNumber.from(31536000).div(13);

  const precision = 10000;
  const ratePerYearInWad = BigNumber.from((apy * precision) / 100)
    .mul(wad)
    .div(precision); //
  return ratePerYearInWad.div(blocksPerYear);
}

describe("Compound Borrow Rate Oracle", () => {
  const ratePerBlock = calculateRatePerBlockFromAPY(2);

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

      const initBorrowIndex = wad;
      const expectedRate = computeExpectedRate(
        ratePerBlock,
        blockDelta,
        initBorrowIndex
      );

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(expectedRate);

      lastObservedRateInWad = rate.div(semiWad);
    });

    it(`Verify borrow rate blockDelta is 0`, async () => {
      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(lastObservedRateInWad.mul(semiWad));
    });

    it(`Verify borrow rate when blockDelta is 1`, async () => {
      const blockNow = await provider.getBlockNumber();
      await cToken.setAccrualBlockNumber(blockNow);

      const initBorrowIndex = wad;
      const expectedRate = computeExpectedRate(
        ratePerBlock,
        BigNumber.from(1),
        initBorrowIndex
      );

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.eq(expectedRate);

      lastObservedRateInWad = rate.div(semiWad);
    });

    it(`Verify borrow rate after index update`, async () => {
      await cToken.setBorrowIndex(lastObservedRateInWad);

      const blockNow = await provider.getBlockNumber();
      await cToken.setAccrualBlockNumber(blockNow - 3);
      const blockDelta = BigNumber.from(4); // 1 block diff

      const expectedRate = computeExpectedRate(
        ratePerBlock,
        blockDelta,
        lastObservedRateInWad
      );

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();
      expect(rate).to.eq(expectedRate);
    });

    it(`Verify borrow rate when blockDelta is bigger`, async () => {
      await advanceTimeAndBlock(BigNumber.from(86400), 1220);
      const blockNow = await provider.getBlockNumber();
      await cToken.setAccrualBlockNumber(blockNow - 1220);

      const blockDelta = BigNumber.from(1220);

      const expectedRate = computeExpectedRate(
        ratePerBlock,
        blockDelta,
        lastObservedRateInWad
      );

      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();

      expect(rate).to.be.closeTo(expectedRate, BigNumber.from(10).pow(14));
    });

    it(`Failed rate update when rate per block is too high`, async () => {
      await cToken.setBorrowRatePerBlock(ratePerBlock.mul(semiWad)); // by 1e9

      await expect(testCompoundBorrowRateOracle.getLastUpdatedRate()).to.be
        .reverted;
    });

    it(`Verify rate compounds as expected`, async () => {
      const [_, rate] = await testCompoundBorrowRateOracle.getLastUpdatedRate();
      await testCompoundBorrowRateOracle.writeOracleEntry();

      lastObservedRateInWad = rate.div(semiWad);
      await cToken.setBorrowIndex(lastObservedRateInWad);
      const accrualBlockNumber = (await provider.getBlock("latest")).number;
      await cToken.setAccrualBlockNumber(accrualBlockNumber);

      let expectedIndex = lastObservedRateInWad; // cumulate index as expected

      const blockIntervals = [1001, 272, 767, 180, 310, 99, 70];
      const apys = [1, 5.5, 7, 1.8, 3, 9, 30];

      expect(blockIntervals.length).to.be.eq(apys.length);

      for (let i = 0; i < apys.length; i++) {
        // set new rate

        const blockDelta = blockIntervals[i];
        const apy = apys[i];
        const ratePerBlockCurrent = calculateRatePerBlockFromAPY(apy);
        await cToken.setBorrowRatePerBlock(ratePerBlockCurrent);

        // advance time for rate to compound
        await advanceTimeAndBlock(BigNumber.from(13 * blockDelta), blockDelta);

        expectedIndex = computeExpectedRate(
          ratePerBlockCurrent,
          BigNumber.from(blockDelta),
          expectedIndex.div(semiWad)
        );

        // write oracle observation

        const [_, rate] =
          await testCompoundBorrowRateOracle.getLastUpdatedRate();
        await testCompoundBorrowRateOracle.writeOracleEntry();
        lastObservedRateInWad = rate.div(semiWad);

        // update borrow index in CToken

        const blockNow = (await provider.getBlock("latest")).number;
        await cToken.setBorrowIndex(lastObservedRateInWad);
        await cToken.setAccrualBlockNumber(blockNow);
      }

      const [rateIndex, ,] = await testCompoundBorrowRateOracle.oracleVars();
      const latestRate = (
        await testCompoundBorrowRateOracle.observations(rateIndex)
      ).observedValue;

      expect(expectedIndex).to.be.closeTo(
        latestRate.div(semiWad),
        BigNumber.from(10).pow(12)
      );
    });
  });
});
