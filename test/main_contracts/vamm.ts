import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { TestVAMMCallee } from "../../typechain/TestVAMMCallee";
import {
  getMaxTick,
  getMinTick,
  TICK_SPACING,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
  getGrowthInside,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { TestAMM } from "../../typechain/TestAMM";
import { ERC20Mock } from "../../typechain";

const createFixtureLoader = waffle.createFixtureLoader;
// type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let ammTest: TestAMM;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let vammCalleeTest: TestVAMMCallee;
  let token: ERC20Mock;

  let tickSpacing: number;
  let minTick: number;
  let maxTick: number;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ ammTest, vammTest, marginEngineTest, vammCalleeTest, token } =
      await loadFixture(metaFixture));

    minTick = getMinTick(TICK_SPACING);
    maxTick = getMaxTick(TICK_SPACING);

    tickSpacing = TICK_SPACING;
  });

  describe("#computePositionFixedAndVariableGrowthInside", async () => {
    beforeEach("set ticks", async () => {
      // make sure the default values set are sensible
      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutside: toBn("1.0"),
        variableTokenGrowthOutside: toBn("-2.0"),
        feeGrowthOutside: toBn("0.1"),
        initialized: true,
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutside: toBn("3.0"),
        variableTokenGrowthOutside: toBn("-4.0"),
        feeGrowthOutside: toBn("0.2"),
        initialized: true,
      });

      await vammTest.setFixedTokenGrowthGlobal(toBn("5.0"));
      await vammTest.setVariableTokenGrowthGlobal(toBn("-7.0"));
    });

    it("correctly computes position fixed and variable growth inside", async () => {
      const realized =
        await vammCalleeTest.computePositionFixedAndVariableGrowthInsideTest(
          vammTest.address,
          -1,
          1,
          0
        );
      const realizedFixedTokenGrowthInside = realized[0];
      const realizedVariableTokenGrowthInside = realized[1];

      const expectedFixedTokenGrowthInside = getGrowthInside(
        0,
        -1,
        1,
        toBn("1.0"),
        toBn("3.0"),
        toBn("5.0")
      );
      console.log("TESTTT: ", realizedFixedTokenGrowthInside.toString());
      console.log("TESTTT: ", realizedVariableTokenGrowthInside.toString());
      expect(realizedFixedTokenGrowthInside).to.eq(
        expectedFixedTokenGrowthInside
      );

      const expectedVariableTokenGrowthInside = getGrowthInside(
        0,
        -1,
        1,
        toBn("-2.0"),
        toBn("-4.0"),
        toBn("-7.0")
      );

      expect(realizedVariableTokenGrowthInside).to.eq(
        expectedVariableTokenGrowthInside
      );
    });
  });

  describe("#quickChecks", async () => {
    it("check underlying token of the amm and marginEngine are set consistently", async () => {
      const underlyingToken1 = await ammTest.underlyingToken();
      const underlyingToken2 = await marginEngineTest.getUnderlyingToken();
      expect(underlyingToken1).to.eq(underlyingToken2);
      // await expect(ammTest.underlyingToken()).to.eq(mainnetConstants.tokens.USDC.address);
    });

    // it("check the margin engine can call the amm", async () => {

    // });

    it("check the amm can call the vamm", async () => {
      const currentTick = await ammTest.testGetCurrentTickFromVAMM();
      console.log("Current Tick is", currentTick);
      expect(currentTick).to.eq(0);
    });

    // it("check the rate for termStartTimestamp has been set", async () => {
    //   const
    // })
  });

  describe("#initialize", async () => {
    it("fails if already initialized", async () => {
      await vammTest.initialize(encodeSqrtRatioX96(1, 1).toString());
      await expect(vammTest.initialize(encodeSqrtRatioX96(1, 1).toString())).to
        .be.reverted;
    });

    it("fails if starting price is too low", async () => {
      await expect(vammTest.initialize(1)).to.be.reverted;
      await expect(vammTest.initialize(MIN_SQRT_RATIO.sub(1))).to.be.reverted;
      // await expect(pool.initialize(1)).to.be.revertedWith('R')
      // await expect(pool.initialize(MIN_SQRT_RATIO.sub(1))).to.be.revertedWith('R')
    });

    it("fails if starting price is too high", async () => {
      await expect(vammTest.initialize(MAX_SQRT_RATIO)).to.be.reverted;
      await expect(vammTest.initialize(BigNumber.from(2).pow(160).sub(1))).to.be
        .reverted;
    });

    it("can be initialized at MIN_SQRT_RATIO", async () => {
      await vammTest.initialize(MIN_SQRT_RATIO);
      expect((await vammTest.slot0()).tick).to.eq(getMinTick(1));
    });
  });

  describe("#mint", () => {
    it("fails if not initialized", async () => {
      await expect(
        vammCalleeTest.mintTest(
          vammTest.address,
          wallet.address,
          -tickSpacing,
          tickSpacing,
          1
        )
      ).to.be.reverted;
    });

    describe("after initialization", async () => {
      beforeEach("initialize the pool at price of 10:1", async () => {
        await vammTest.initialize(encodeSqrtRatioX96(1, 10).toString());

        await token.mint(wallet.address, BigNumber.from(10).pow(27));
        await token.approve(wallet.address, BigNumber.from(10).pow(27));

        await marginEngineTest.updatePositionMargin(
          {
            owner: wallet.address,
            tickLower: minTick,
            tickUpper: maxTick,
            liquidityDelta: 0,
          },
          toBn("100000")
        );

        await vammCalleeTest.mintTest(
          vammTest.address,
          wallet.address,
          minTick,
          maxTick,
          3161
        );
      });

      describe("failure cases", async () => {
        it("fails if tickLower greater than tickUpper", async () => {
          // await expect(mint(wallet.address, 1, 0, 1)).to.be.reverted
          await expect(
            vammCalleeTest.mintTest(vammTest.address, wallet.address, 1, 0, 1)
          ).to.be.reverted;
        });

        it("fails if tickLower less than min tick", async () => {
          // should be TLM but...hardhat
          await expect(
            vammCalleeTest.mintTest(
              vammTest.address,
              wallet.address,
              -887273,
              0,
              1
            )
          ).to.be.reverted;
        });

        it("fails if tickUpper greater than max tick", async () => {
          // should be TUM but...hardhat
          await expect(
            vammCalleeTest.mintTest(
              vammTest.address,
              wallet.address,
              0,
              887273,
              1
            )
          ).to.be.reverted;
        });

        it("fails if amount exceeds the max", async () => {
          const maxLiquidityGross = await vammTest.maxLiquidityPerTick();
          await expect(
            vammCalleeTest.mintTest(
              vammTest.address,
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.add(1)
            )
          ).to.be.reverted;
          // AB: fails
          // await expect(vammCalleeTest.mintTest(vammTest.address, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross.sub(10000))).to.not.be.reverted;
        });

        // AB: get back to this
        // it("fails if total amount at tick exceeds the max", async () => {
        //   await vammCalleeTest.mintTest(vammTest.address, wallet.address, minTick+tickSpacing, maxTick-tickSpacing, 1000);
        //   const maxLiquidityGross = await vammTest.maxLiquidityPerTick();
        //   console.log("maxLiquidityGross: ", maxLiquidityGross);
        //   // await expect(
        //   //   mint(wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross.sub(1000).add(1))
        //   // ).to.be.reverted
        //   // await marginEngineTest.setPosition(wallet.address, -tickSpacing, tickSpacing, 1, toBn("1000000000000000000000.0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), toBn("0"), false);
        //   // await expect(vammTest.mint(wallet.address, -tickSpacing, tickSpacing, maxLiquidityGross.sub(1000).add(1))).to.be.reverted;
        // })
      });

      describe("success cases", async () => {
        it("initial tick", async () => {
          expect((await vammTest.slot0()).tick).to.eq(-23028);
        });

        it("adds liquidity to liquidityGross", async () => {
          await vammCalleeTest.mintTest(
            vammTest.address,
            wallet.address,
            -240,
            0,
            100
          );
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
          await vammCalleeTest.mintTest(
            vammTest.address,
            wallet.address,
            -240,
            tickSpacing,
            150
          );
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
          await vammCalleeTest.mintTest(
            vammTest.address,
            wallet.address,
            0,
            tickSpacing * 2,
            60
          );
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
          await vammCalleeTest.mintTest(
            vammTest.address,
            wallet.address,
            -240,
            0,
            100
          );
          await vammCalleeTest.mintTest(
            vammTest.address,
            wallet.address,
            -240,
            0,
            40
          );
          // await vammCalleeTest.burn( )
        });

        // it('removes liquidity from liquidityGross', async () => {
        //   await mint(wallet.address, -240, 0, 100)
        //   await mint(wallet.address, -240, 0, 40)
        //   await pool.burn(-240, 0, 90)
        //   expect((await pool.ticks(-240)).liquidityGross).to.eq(50)
        //   expect((await pool.ticks(0)).liquidityGross).to.eq(50)
        // })
      });
    });
  });
});
