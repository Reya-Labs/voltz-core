import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { TestVAMMCallee } from "../../typechain/TestVAMMCallee";
import {
  getPositionKey,
  getMaxTick,   
  getMinTick,
  TICK_SPACING,
  createVAMMMFunctions,
  SwapFunction,
  MintFunction,
  getMaxLiquidityPerTick,
  MaxUint128,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
  SwapToPriceFunction,
  mint,
} from "../shared/utilities";
import { consts } from "../helpers/constants";
// import { devConstants, mainnetConstants } from "../helpers/constants";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { RATE_ORACLE_ID, getGrowthInside } from "../shared/utilities";
import { getCurrentTimestamp } from "../helpers/time";
const { provider } = waffle;
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
import { TestAMM } from "../../typechain/TestAMM";
import { sub, add } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;


describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let factory: Factory;
  let ammTest: TestAMM;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let vammCalleeTest: TestVAMMCallee;
  let marginEngineCalleeTest: TestMarginEngineCallee;

  let tickSpacing: number;
  let minTick: number;
  let maxTick: number;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      factory,
      ammTest,
      vammTest,
      marginEngineTest,
      vammCalleeTest,
      marginEngineCalleeTest,
    } = await loadFixture(metaFixture));

    minTick = getMinTick(TICK_SPACING);
    maxTick = getMaxTick(TICK_SPACING);

    tickSpacing = TICK_SPACING;
  });


  describe("#computePositionFixedAndVariableGrowthInside", async () => {

    beforeEach("set ticks", async () => {
      // todo make sure the default values set are sensible
      await vammTest.setTickTest(-1, {
        liquidityGross: 10,
        liquidityNet: 20,
        fixedTokenGrowthOutside: toBn("1.0"),
        variableTokenGrowthOutside: toBn("-2.0"),
        feeGrowthOutside: toBn("0.1"),
        initialized: true
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutside: toBn("3.0"),
        variableTokenGrowthOutside: toBn("-4.0"),
        feeGrowthOutside: toBn("0.2"),
        initialized: true
      });

      await vammTest.setFixedTokenGrowthGlobal(toBn("5.0"));
      await vammTest.setVariableTokenGrowthGlobal(toBn("-7.0"));

    })


    it("correctly computes position fixed and variable growth inside", async () => {
      const realized = await vammCalleeTest.computePositionFixedAndVariableGrowthInsideTest(vammTest.address, -1, 1, 0);
      const realizedFixedTokenGrowthInside = realized[0];
      const realizedVariableTokenGrowthInside = realized[1];

      const expectedFixedTokenGrowthInside = getGrowthInside(0, -1, 1, toBn("1.0"), toBn("3.0"), toBn("5.0"));
      console.log("TESTTT: ", realizedFixedTokenGrowthInside.toString());
      console.log("TESTTT: ", realizedVariableTokenGrowthInside.toString());
      expect(realizedFixedTokenGrowthInside).to.eq(expectedFixedTokenGrowthInside);
      
      const expectedVariableTokenGrowthInside = getGrowthInside(0, -1, 1, toBn("-2.0"), toBn("-4.0"), toBn("-7.0"));

      expect(realizedVariableTokenGrowthInside).to.eq(expectedVariableTokenGrowthInside);


    })

  })

  describe("#quickChecks", async () => {
    it("check underlying token of the amm and marginEngine are set consistently", async () => {
      const underlyingToken1 = await ammTest.underlyingToken();
      const underlyingToken2 = await marginEngineTest.getUnderlyingToken();
      expect(underlyingToken1).to.eq(underlyingToken2);
      // await expect(ammTest.underlyingToken()).to.eq(mainnetConstants.tokens.USDC.address);
    });

    it("check the margin engine can call the amm", async () => {
      // todo
    });

    it("check the amm can call the vamm", async () => {
      // (, int24 tick,) = amm.vamm().slot0();
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

    // more tests in here
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
        await vammCalleeTest.mintTest(
          vammTest.address,
          wallet.address,
          minTick,
          maxTick,
          3161
        );
      });

      // describe("failure cases", async () => {

      //   it('fails if tickLower greater than tickUpper', async () => {
      //     await expect(vammCalleeTest.mintTest(vammTest.address, wallet.address, 1, 0, 1)).to.be.reverted
      //   })

      // })
    });
  });

  // describe("#mint", () => {
  //   it("fails if not initialized", async () => {
  //     await expect(

  //       vammTest.mintTest(wallet.address, -tickSpacing, tickSpacing, 1)
  //     ).to.be.reverted;
  //   });
  //   // more tests in here
  //   // using callee results in a timeout for some reason, haven't been able to debug yet
  // });
});