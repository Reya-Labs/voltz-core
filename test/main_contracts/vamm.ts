import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import {
  getMaxTick,
  getMinTick,
  TICK_SPACING,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
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
import { ERC20Mock, MockAaveLendingPool } from "../../typechain";
import { advanceTimeAndBlock } from "../helpers/time";
import { consts } from "../helpers/constants";
import { sub } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;

// need more vamm tests!

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;

  let tickSpacing: number;
  let minTick: number;
  let maxTick: number;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ token, aaveLendingPool, vammTest, marginEngineTest } = await loadFixture(
      metaFixture
    ));

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

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      BigNumber.from(2).pow(27)
    );

    minTick = getMinTick(TICK_SPACING);
    maxTick = getMaxTick(TICK_SPACING);

    tickSpacing = TICK_SPACING;
  });

  describe("#computePositionFixedAndVariableGrowthInside", async () => {
    beforeEach("set ticks", async () => {
      const Q128 = BigNumber.from(2).pow(128);
      const Q128Negative = Q128.mul(BigNumber.from(-1));

      const FourQ128 = BigNumber.from(4).shl(128);
      const FourQ128Negative = FourQ128.mul(BigNumber.from(-1));

      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutsideX128: Q128,
        variableTokenGrowthOutsideX128: Q128Negative,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutsideX128: Q128Negative,
        variableTokenGrowthOutsideX128: Q128,
        feeGrowthOutsideX128: 0,
        initialized: true,
      });

      await vammTest.setFixedTokenGrowthGlobal(FourQ128);
      await vammTest.setVariableTokenGrowthGlobal(FourQ128Negative);
    });
  });

  describe("#quickChecks", async () => {
    it("check the current tick", async () => {
      const currentTick = (await vammTest.vammVars()).tick;
      expect(currentTick).to.eq(0);
    });
  });

  describe("#initialize", async () => {
    it("fails if already initialized", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
      // await expect( vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString()) ).to.be.revertedWith("ExpectedSqrtPriceZeroBeforeInit");
      // at the time of writing, hardhat won't decipher custom errors thrown via proxies
      await expect(vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString()))
        .to.be.reverted;
    });

    it("fails if starting price is too low", async () => {
      await expect(vammTest.initializeVAMM(1)).to.be.revertedWith("R");
      await expect(
        vammTest.initializeVAMM(MIN_SQRT_RATIO.sub(1))
      ).to.be.revertedWith("R");
    });

    it("fails if starting price is too high", async () => {
      await expect(vammTest.initializeVAMM(MAX_SQRT_RATIO)).to.be.revertedWith(
        "R"
      );
      await expect(
        vammTest.initializeVAMM(BigNumber.from(2).pow(160).sub(1))
      ).to.be.revertedWith("R");
    });

    it("can be initialized at MIN_SQRT_RATIO", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);
      expect((await vammTest.vammVars()).tick).to.eq(getMinTick(1));
    });
  });

  describe("#mint", () => {
    it("fails if not initialized", async () => {
      await expect(vammTest.mint(wallet.address, -tickSpacing, tickSpacing, 1))
        .to.be.reverted;
    });

    describe("after initialization", async () => {
      beforeEach("initialize the pool at price of 10:1", async () => {
        await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
        await vammTest.setFeeProtocol(3);

        await token.mint(
          wallet.address,
          "1217962522535726055805955855889380600000000000000000000000000000000"
        );
        await token.approve(
          marginEngineTest.address,
          "1217962522535726055805955855889380600000000000000000000000000000000"
        );

        await marginEngineTest.updatePositionMargin(
          wallet.address,
          minTick,
          maxTick,
          "1217962522535726055805955855889380600"
        );
        await marginEngineTest.updatePositionMargin(
          wallet.address,
          minTick + tickSpacing,
          maxTick - tickSpacing,
          "1217962522535726055805955855889380600"
        );

        await vammTest.mint(wallet.address, minTick, maxTick, 3161);
      });

      describe("failure cases", async () => {
        it("fails if tickLower greater than tickUpper", async () => {
          await expect(vammTest.mint(wallet.address, 1, 0, 1)).to.be.reverted;
        });

        it("fails if tickLower less than min tick", async () => {
          await expect(
            vammTest.mint(wallet.address, -887273, 0, 1)
          ).to.be.revertedWith("TLM");
        });

        it("fails if tickUpper greater than max tick", async () => {
          await expect(
            vammTest.mint(wallet.address, 0, 887273, 1)
          ).to.be.revertedWith("TUM");
        });

        it("fails if amount exceeds the max", async () => {
          const maxLiquidityGross = await vammTest.maxLiquidityPerTick();
          await expect(
            vammTest.mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.add(1)
            )
          ).to.be.revertedWith("LO");
          await expect(
            vammTest.mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.sub(10000)
            )
          ).to.not.be.reverted;
        });

        it("fails if total amount at tick exceeds the max", async () => {
          await vammTest.mint(
            wallet.address,
            minTick + tickSpacing,
            maxTick - tickSpacing,
            1000
          );
          const maxLiquidityGross = await vammTest.maxLiquidityPerTick();
          await expect(
            vammTest.mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.sub(1000).add(1)
            )
          ).to.be.reverted;
        });
      });

      describe("success cases", async () => {
        it("initial tick", async () => {
          expect((await vammTest.vammVars()).tick).to.eq(-23028);
        });

        it("adds liquidity to liquidityGross", async () => {
          await marginEngineTest.updatePositionMargin(
            wallet.address,
            -240,
            0,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, -240, 0, 100);
          const liquidityGross0 = (await vammTest.ticks(-240)).liquidityGross;
          expect(liquidityGross0).to.eq(100);
          const liquidityGross1 = (await vammTest.ticks(0)).liquidityGross;
          expect(liquidityGross1).to.eq(100);
          const liquidityGross2 = (await vammTest.ticks(tickSpacing))
            .liquidityGross;
          const liquidityGross3 = (await vammTest.ticks(tickSpacing * 2))
            .liquidityGross;
          expect(liquidityGross2).to.eq(0);
          expect(liquidityGross3).to.eq(0);

          await marginEngineTest.updatePositionMargin(
            wallet.address,
            -240,
            tickSpacing,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, -240, tickSpacing, 150);
          const liquidityGross4 = (await vammTest.ticks(-240)).liquidityGross;
          expect(liquidityGross4).to.eq(250);
          const liquidityGross5 = (await vammTest.ticks(0)).liquidityGross;
          expect(liquidityGross5).to.eq(100);
          const liquidityGross6 = (await vammTest.ticks(tickSpacing))
            .liquidityGross;
          expect(liquidityGross6).to.eq(150);
          const liquidityGross7 = (await vammTest.ticks(tickSpacing * 2))
            .liquidityGross;
          expect(liquidityGross7).to.eq(0);

          await marginEngineTest.updatePositionMargin(
            wallet.address,
            0,
            tickSpacing * 2,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, 0, tickSpacing * 2, 60);
          const liquidityGross8 = (await vammTest.ticks(-240)).liquidityGross;
          const liquidityGross9 = (await vammTest.ticks(0)).liquidityGross;
          const liquidityGross10 = (await vammTest.ticks(tickSpacing))
            .liquidityGross;
          const liquidityGross11 = (await vammTest.ticks(tickSpacing * 2))
            .liquidityGross;
          expect(liquidityGross8).to.eq(250);
          expect(liquidityGross9).to.eq(160);
          expect(liquidityGross10).to.eq(150);
          expect(liquidityGross11).to.eq(60);
        });

        it("removes liquidity from liquidityGross", async () => {
          await marginEngineTest.updatePositionMargin(
            wallet.address,
            -240,
            0,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, -240, 0, 100);
          await vammTest.mint(wallet.address, -240, 0, 40);
          await vammTest.burn(wallet.address, -240, 0, 90);
          expect((await vammTest.ticks(-240)).liquidityGross).to.eq(50);
          expect((await vammTest.ticks(0)).liquidityGross).to.eq(50);
        });
      });
    });
  });

  describe("#checkCurrentTimestampTermEndTimestampDelta", () => {
    it("check checkCurrentTimestampTermEndTimestampDelta", async () => {
      advanceTimeAndBlock(
        sub(sub(consts.ONE_WEEK, consts.ONE_DAY), consts.ONE_DAY),
        1
      );
      await expect(vammTest.checkMaturityDuration()).to.not.be.reverted;
    });

    it("check checkCurrentTimestampTermEndTimestampDelta", async () => {
      advanceTimeAndBlock(sub(consts.ONE_WEEK, consts.ONE_DAY), 1);
      await expect(vammTest.checkMaturityDuration()).to.be.revertedWith(
        "closeToOrBeyondMaturity"
      );
    });

    it("check checkCurrentTimestampTermEndTimestampDelta", async () => {
      advanceTimeAndBlock(consts.ONE_WEEK, 1);
      await expect(vammTest.checkMaturityDuration()).to.be.revertedWith(
        "closeToOrBeyondMaturity"
      );
    });
  });

  describe("#updateProtocolFees", () => {
    it("check MarginEngine privilege ", async () => {
      // await expect(vammTest.updateProtocolFees(toBn("1"))).to.be.revertedWith( "OnlyMarginEngine" );
      // at the time of writing, waffle won't decipher custom errors thrown via proxies
      await expect(vammTest.updateProtocolFees(toBn("1"))).to.be.reverted;
    });

    it("check not enough Protocol Fees", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      await vammTest.setTestProtocolFees(toBn("3"));
      expect(await vammTest.protocolFees()).to.be.equal(toBn("3"));
      await expect(marginEngineTest.collectProtocol(wallet.address, toBn("4")))
        .to.be.reverted;
    });

    it("check updateProtocolFees", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      await token.mint(marginEngineTest.address, BigNumber.from(10).pow(27));
      await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));
      await vammTest.setTestProtocolFees(toBn("5"));
      expect(await vammTest.protocolFees()).to.be.equal(toBn("5"));
      await marginEngineTest.collectProtocol(wallet.address, toBn("4"));
      //   await expect(marginEngineTest.collectProtocol(wallet.address, toBn("4")))
      //     .to.not.be.reverted;
      expect(await vammTest.protocolFees()).to.be.equal(toBn("1"));
    });
  });

  describe("#setFeeProtocol", () => {
    it("check owner privilege ", async () => {
      await expect(
        vammTest.connect(other).setFeeProtocol(5)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("check setFeeProtocol", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      expect((await vammTest.vammVars()).feeProtocol).to.be.equal(toBn("0"));
      await expect(vammTest.setFeeProtocol(5)).to.not.be.reverted;
      expect((await vammTest.vammVars()).feeProtocol).to.be.equal(5);
    });
  });

  describe("#setFee", () => {
    it("check owner privilege ", async () => {
      await expect(
        vammTest.connect(other).setFee(toBn("0.0005"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("check setFee", async () => {
      expect(await vammTest.feeWad()).to.be.equal(toBn("0"));
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      await expect(vammTest.setFee(toBn("0.0005"))).to.not.be.reverted;
      expect(await vammTest.feeWad()).to.be.equal(toBn("0.0005"));
    });
  });

  describe("#burn", () => {
    it("fails if not initialized", async () => {
      await expect(vammTest.mint(wallet.address, -tickSpacing, tickSpacing, 1))
        .to.be.reverted;
    });

    describe("after initialization", async () => {
      beforeEach("initialize the pool at price of 10:1", async () => {
        await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
        await vammTest.setFeeProtocol(3);

        await token.mint(wallet.address, BigNumber.from(10).pow(27));
        await token.approve(wallet.address, BigNumber.from(10).pow(27));

        await marginEngineTest.updatePositionMargin(
          wallet.address,
          minTick,
          maxTick,
          toBn("100000")
        );

        await vammTest.mint(wallet.address, minTick, maxTick, 3161);
      });

      describe("failure cases", async () => {
        it("fails if tickLower greater than tickUpper", async () => {
          await expect(vammTest.burn(wallet.address, 1, 0, 1)).to.be.reverted;
        });

        it("fails if tickLower less than min tick", async () => {
          // should be TLM but...hardhat
          await expect(
            vammTest.burn(wallet.address, -887273, 0, 1)
          ).to.be.revertedWith("TLM");
        });

        it("fails if tickUpper greater than max tick", async () => {
          // should be TUM but...hardhat
          await expect(
            vammTest.burn(wallet.address, 0, 887273, 1)
          ).to.be.revertedWith("TUM");
        });
      });

      describe("success cases", async () => {
        it("initial tick", async () => {
          expect((await vammTest.vammVars()).tick).to.eq(-23028);
        });

        it("adds liquidity to liquidityGross", async () => {
          await marginEngineTest.updatePositionMargin(
            wallet.address,
            -240,
            0,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, -240, 0, 100);

          await marginEngineTest.updatePositionMargin(
            wallet.address,
            -240,
            60,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, -240, 60, 150);

          await marginEngineTest.updatePositionMargin(
            wallet.address,
            0,
            120,
            toBn("100000")
          );

          await vammTest.mint(wallet.address, 0, 120, 60);

          // start burning

          await vammTest.burn(wallet.address, -240, 0, 70);
          expect((await vammTest.ticks(-240)).liquidityGross).to.eq(180);
          expect((await vammTest.ticks(0)).liquidityGross).to.eq(90);
          expect((await vammTest.ticks(60)).liquidityGross).to.eq(150);
          expect((await vammTest.ticks(120)).liquidityGross).to.eq(60);

          await vammTest.burn(wallet.address, -240, 60, 150);
          expect((await vammTest.ticks(-240)).liquidityGross).to.eq(30);
          expect((await vammTest.ticks(0)).liquidityGross).to.eq(90);
          expect((await vammTest.ticks(60)).liquidityGross).to.eq(0);
          expect((await vammTest.ticks(120)).liquidityGross).to.eq(60);

          await expect(vammTest.burn(wallet.address, 0, 120, 70)).to.be
            .reverted;

          await expect(vammTest.burn(wallet.address, -60, 60, 1)).to.be
            .reverted;
        });
      });
    });
  });
});
