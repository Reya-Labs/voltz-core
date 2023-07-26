import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import {
  TICK_SPACING,
  MIN_SQRT_RATIO,
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { ERC20Mock, FeeCollector, MockAaveLendingPool } from "../../typechain";
import { TickMath } from "../shared/tickMath";

const createFixtureLoader = waffle.createFixtureLoader;

// more vamm tests!

describe("Fee Collector", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;
  let feeCollectorTest: FeeCollector;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ token, aaveLendingPool, vammTest, marginEngineTest, feeCollectorTest } =
      await loadFixture(metaFixture));

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    const margin_engine_params = {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: SIGMA_SQUARED,
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),
      gap7: toBn("0"),

      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);

    // set factor per second
    await aaveLendingPool.setFactorPerSecondInRay(
      token.address,
      "1000000001000000000000000000"
    );
  });

  describe("#swapAndBurn", () => {
    beforeEach("initialize the pool at price of 1:1", async () => {
      await token.mint(wallet.address, BigNumber.from(10).pow(27));
      await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      await token.mint(other.address, BigNumber.from(10).pow(27));
      await token
        .connect(other)
        .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

      await marginEngineTest.updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );

      await marginEngineTest
        .connect(other)
        .updatePositionMargin(
          other.address,
          -TICK_SPACING,
          TICK_SPACING,
          toBn("100000")
        );
    });

    it("happy path", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.setFeeProtocol(3);
      await vammTest.setFee(toBn("0.006"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("520"),
        sqrtPriceLimitX96: BigNumber.from(
          TickMath.getSqrtRatioAtTick(TICK_SPACING * 2).toString()
        ),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      // mint 100_000, swap 100
      // fee = 520 * 1/52 * 0.06 = 0.06
      // protocolFee = 0.02
      // LP fee = 0.5
      const accumulatedProtocolFee = await vammTest.getProtocolFees();
      const expectedFees = BigNumber.from("20000000000000000");

      console.log("PROT FEE", accumulatedProtocolFee.toString()); // 19944545915778813
      expect(accumulatedProtocolFee).to.be.closeTo(
        expectedFees,
        accumulatedProtocolFee.div(100)
      ); // 1% error

      // COLLECT
      await marginEngineTest
        .connect(wallet)
        .collectProtocol(feeCollectorTest.address, accumulatedProtocolFee);
      expect(accumulatedProtocolFee).to.be.eq(
        await token.balanceOf(feeCollectorTest.address)
      );

      // DISTRIBUTE
      await feeCollectorTest.connect(wallet).distributeFees(token.address);
      expect(accumulatedProtocolFee.div(2)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );
      expect(accumulatedProtocolFee.div(2)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );

      // COLLECT FRACTION
      const balance0 = await token.balanceOf(wallet.address);
      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, accumulatedProtocolFee.div(6), true);
      const balance1 = await token.balanceOf(wallet.address);
      expect(accumulatedProtocolFee.div(6)).to.be.eq(balance1.sub(balance0));
      expect(accumulatedProtocolFee.div(3)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );

      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, accumulatedProtocolFee.div(4), false);
      const balance2 = await token.balanceOf(wallet.address);
      expect(accumulatedProtocolFee.div(4)).to.be.eq(balance2.sub(balance1));
      expect(accumulatedProtocolFee.div(4)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );

      // COLLECT ALL
      const maxFlag =
        "0x8000000000000000000000000000000000000000000000000000000000000000";
      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, maxFlag, true);
      const balance3 = await token.balanceOf(wallet.address);
      expect(accumulatedProtocolFee.div(6).mul(2)).to.be.closeTo(
        balance3.sub(balance2),
        1
      );
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );

      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, maxFlag, false);
      const balance4 = await token.balanceOf(wallet.address);
      expect(accumulatedProtocolFee.div(4)).to.be.eq(balance4.sub(balance3));
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );
    });

    it("access control", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.setFeeProtocol(3);
      await vammTest.setFee(toBn("0.006"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("520"),
        sqrtPriceLimitX96: BigNumber.from(
          TickMath.getSqrtRatioAtTick(TICK_SPACING * 2).toString()
        ),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      // mint 100_000, swap 100
      // fee = 520 * 1/52 * 0.06 = 0.06
      // protocolFee = 0.02
      // LP fee = 0.5
      const accumulatedProtocolFee = await vammTest.getProtocolFees();
      const expectedFees = BigNumber.from("20000000000000000");

      console.log("PROT FEE", accumulatedProtocolFee.toString()); // 19944545915778813
      expect(accumulatedProtocolFee).to.be.closeTo(
        expectedFees,
        accumulatedProtocolFee.div(100)
      ); // 1% error

      // COLLECT
      await expect(
        marginEngineTest
          .connect(other)
          .collectProtocol(feeCollectorTest.address, accumulatedProtocolFee)
      ).to.be.reverted;
      await marginEngineTest
        .connect(wallet)
        .collectProtocol(feeCollectorTest.address, accumulatedProtocolFee);
      expect(accumulatedProtocolFee).to.be.eq(
        await token.balanceOf(feeCollectorTest.address)
      );

      // DISTRIBUTE
      await expect(
        feeCollectorTest.connect(other).distributeFees(token.address)
      ).to.be.reverted;
      await feeCollectorTest.connect(wallet).distributeFees(token.address);

      // COLLECT
      await expect(
        feeCollectorTest
          .connect(other)
          .collectFees(token.address, accumulatedProtocolFee.div(6), true)
      ).to.be.reverted; // not owner

      await expect(
        feeCollectorTest
          .connect(wallet)
          .collectFees(token.address, accumulatedProtocolFee.mul(6), true)
      ).to.be.reverted; // too much
      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, accumulatedProtocolFee.div(6), true);

      await expect(
        feeCollectorTest
          .connect(other)
          .collectFees(token.address, accumulatedProtocolFee.div(6), false)
      ).to.be.reverted; // not owner

      await expect(
        feeCollectorTest
          .connect(wallet)
          .collectFees(token.address, accumulatedProtocolFee.mul(6), false)
      ).to.be.reverted; // too much
      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, accumulatedProtocolFee.div(6), false);
    });

    it("pause distribution", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);

      await vammTest.setFeeProtocol(3);
      await vammTest.setFee(toBn("0.006"));

      await vammTest
        .connect(wallet)
        .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));

      await vammTest.connect(other).swap({
        recipient: other.address,
        amountSpecified: toBn("520"),
        sqrtPriceLimitX96: BigNumber.from(
          TickMath.getSqrtRatioAtTick(TICK_SPACING * 2).toString()
        ),

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      });

      // mint 100_000, swap 100
      // fee = 520 * 1/52 * 0.06 = 0.06
      // protocolFee = 0.02
      // LP fee = 0.5
      const accumulatedProtocolFee = await vammTest.getProtocolFees();
      const expectedFees = BigNumber.from("20000000000000000");

      console.log("PROT FEE", accumulatedProtocolFee.toString()); // 19944545915778813
      expect(accumulatedProtocolFee).to.be.closeTo(
        expectedFees,
        accumulatedProtocolFee.div(100)
      ); // 1% error

      // COLLECT
      await marginEngineTest
        .connect(wallet)
        .collectProtocol(feeCollectorTest.address, accumulatedProtocolFee);
      expect(accumulatedProtocolFee).to.be.eq(
        await token.balanceOf(feeCollectorTest.address)
      );

      // PAUSE
      await expect(feeCollectorTest.connect(other).setDefaultFundPaused(true))
        .to.be.reverted;
      await feeCollectorTest.connect(wallet).setDefaultFundPaused(true);

      // DISTRIBUTE
      await feeCollectorTest.connect(wallet).distributeFees(token.address);
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );
      expect(accumulatedProtocolFee).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );

      // COLLECT FRACTION
      const balance0 = await token.balanceOf(wallet.address);
      await expect(
        feeCollectorTest.connect(wallet).collectFees(token.address, "1", true)
      ).to.be.reverted;
      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, BigNumber.from(0), true);
      const balance1 = await token.balanceOf(wallet.address);
      expect(BigNumber.from(0)).to.be.eq(balance1.sub(balance0));
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );

      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, accumulatedProtocolFee, false);
      const balance2 = await token.balanceOf(wallet.address);
      expect(accumulatedProtocolFee).to.be.eq(balance2.sub(balance1));
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );

      // COLLECT ALL - empty fund
      const maxFlag =
        "0x8000000000000000000000000000000000000000000000000000000000000000";
      await feeCollectorTest
        .connect(wallet)
        .collectFees(token.address, maxFlag, true);
      const balance3 = await token.balanceOf(wallet.address);
      expect(BigNumber.from(0)).to.be.closeTo(balance3.sub(balance2), 1);
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );
    });

    it("multiple pools - happy path", async () => {
      // DEFPLOY FIXTURES 2
      let token2: ERC20Mock;
      let vammTest2: TestVAMM;
      let marginEngineTest2: TestMarginEngine;
      let aaveLendingPool2: MockAaveLendingPool;
      {
        ({
          token: token2,
          aaveLendingPool: aaveLendingPool2,
          vammTest: vammTest2,
          marginEngineTest: marginEngineTest2,
        } = await metaFixture());

        // update marginEngineTest allowance
        await token2.approve(
          marginEngineTest2.address,
          BigNumber.from(10).pow(27)
        );

        const margin_engine_params = {
          apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
          apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
          minDeltaLMWad: MIN_DELTA_LM,
          minDeltaIMWad: MIN_DELTA_IM,
          sigmaSquaredWad: SIGMA_SQUARED,
          alphaWad: ALPHA,
          betaWad: BETA,
          xiUpperWad: XI_UPPER,
          xiLowerWad: XI_LOWER,
          tMaxWad: T_MAX,

          etaIMWad: toBn("0.002"),
          etaLMWad: toBn("0.001"),
          gap1: toBn("0"),
          gap2: toBn("0"),
          gap3: toBn("0"),
          gap4: toBn("0"),
          gap5: toBn("0"),
          gap6: toBn("0"),
          gap7: toBn("0"),

          minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
        };

        await marginEngineTest2.setMarginCalculatorParameters(
          margin_engine_params
        );

        // set factor per second
        await aaveLendingPool2.setFactorPerSecondInRay(
          token2.address,
          "1000000001000000000000000000"
        );
      }

      // INITIALIZE POOL 2
      // eslint-disable-next-line no-lone-blocks
      {
        await token2.mint(wallet.address, BigNumber.from(10).pow(27));
        await token2.approve(
          marginEngineTest2.address,
          BigNumber.from(10).pow(27)
        );

        await token2.mint(other.address, BigNumber.from(10).pow(27));
        await token2
          .connect(other)
          .approve(marginEngineTest2.address, BigNumber.from(10).pow(27));

        await marginEngineTest2.updatePositionMargin(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING,
          toBn("100000")
        );

        await marginEngineTest2
          .connect(other)
          .updatePositionMargin(
            other.address,
            -TICK_SPACING,
            TICK_SPACING,
            toBn("100000")
          );
      }

      // POOL 1 ACTIONS
      // eslint-disable-next-line no-lone-blocks
      {
        await vammTest.initializeVAMM(MIN_SQRT_RATIO);
        await vammTest.setFeeProtocol(3);
        await vammTest.setFee(toBn("0.006"));
        await vammTest
          .connect(wallet)
          .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("100000"));
        await vammTest.connect(other).swap({
          recipient: other.address,
          amountSpecified: toBn("520"),
          sqrtPriceLimitX96: BigNumber.from(
            TickMath.getSqrtRatioAtTick(TICK_SPACING * 2).toString()
          ),
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
        });
      }

      // POOL 2 ACTIONS
      // eslint-disable-next-line no-lone-blocks
      {
        await vammTest2.initializeVAMM(MIN_SQRT_RATIO);
        await vammTest2.setFeeProtocol(3);
        await vammTest2.setFee(toBn("0.006"));
        await vammTest2
          .connect(wallet)
          .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("1000000"));
        await vammTest2.connect(other).swap({
          recipient: other.address,
          amountSpecified: toBn("5200"),
          sqrtPriceLimitX96: BigNumber.from(
            TickMath.getSqrtRatioAtTick(TICK_SPACING * 2).toString()
          ),
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
        });
      }

      // mint 100_000, swap 100
      // fee = 520 * 1/52 * 0.06 = 0.06
      // protocolFee = 0.02
      // LP fee = 0.5
      const accumulatedProtocolFee = await vammTest.getProtocolFees();
      const expectedFees = BigNumber.from("17093944698122760");
      expect(accumulatedProtocolFee).to.be.closeTo(
        expectedFees,
        accumulatedProtocolFee.div(100)
      ); // 1% error
      const accumulatedProtocolFee2 = await vammTest2.getProtocolFees();
      const expectedFees2 = BigNumber.from("200000000000000000");
      expect(accumulatedProtocolFee2).to.be.closeTo(
        expectedFees2,
        accumulatedProtocolFee2.div(100)
      ); // 1% error

      // COLLECT
      await marginEngineTest
        .connect(wallet)
        .collectProtocol(feeCollectorTest.address, accumulatedProtocolFee);
      expect(accumulatedProtocolFee).to.be.eq(
        await token.balanceOf(feeCollectorTest.address)
      );
      await marginEngineTest2
        .connect(wallet)
        .collectProtocol(feeCollectorTest.address, accumulatedProtocolFee2);
      expect(accumulatedProtocolFee2).to.be.eq(
        await token2.balanceOf(feeCollectorTest.address)
      );

      // DISTRIBUTE
      await feeCollectorTest
        .connect(wallet)
        .distributeAllFees([token.address, token2.address]);
      expect(accumulatedProtocolFee.div(2)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );
      expect(accumulatedProtocolFee.div(2)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );
      expect(accumulatedProtocolFee2.div(2)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token2.address)
      );
      expect(accumulatedProtocolFee2.div(2)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token2.address)
      );

      // COLLECT ALL
      const balance0_token1 = await token.balanceOf(wallet.address);
      const balance0_token2 = await token2.balanceOf(wallet.address);
      await feeCollectorTest
        .connect(wallet)
        .collectAllFees([token.address, token2.address], true);
      const balance1_token1 = await token.balanceOf(wallet.address);
      const balance1_token2 = await token2.balanceOf(wallet.address);
      expect(accumulatedProtocolFee.div(2)).to.be.closeTo(
        balance1_token1.sub(balance0_token1),
        1
      );
      expect(accumulatedProtocolFee2.div(2)).to.be.closeTo(
        balance1_token2.sub(balance0_token2),
        1
      );
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token.address)
      );
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getDefaultFund(token2.address)
      );

      await feeCollectorTest
        .connect(wallet)
        .collectAllFees([token.address, token2.address], false);
      const balance2_token1 = await token.balanceOf(wallet.address);
      const balance2_token2 = await token2.balanceOf(wallet.address);
      expect(accumulatedProtocolFee.div(2)).to.be.closeTo(
        balance2_token1.sub(balance1_token1),
        1
      );
      expect(accumulatedProtocolFee2.div(2)).to.be.closeTo(
        balance2_token2.sub(balance1_token2),
        1
      );
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token.address)
      );
      expect(BigNumber.from(0)).to.be.eq(
        await feeCollectorTest.getProtocolFees(token2.address)
      );
    });
  });
});
