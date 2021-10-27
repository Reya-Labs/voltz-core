import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { AMMFactory } from "../typechain/AMMFactory";
import { expect } from "chai";

import {
  MintFunction,
  createAMMFunctions,
  getMinTick,
  getMaxTick,
  FeeAmount,
  TICK_SPACINGS,
  getMaxLiquidityPerTick,
  encodeSqrtRatioX96,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "./shared/utilities";

import { AMMFixture, TEST_AMM_START_TIME } from "./shared/fixtures";

import { TestAMMCallee } from "../typechain/TestAMMCallee";

import { MockTimeAMM } from "../typechain/MockTimeAMM";
import { aave_lending_pool_addr, term_in_days, usdc_mainnet_addr } from "./shared/constants";

const createFixtureLoader = waffle.createFixtureLoader;

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("AMM", () => {
  let wallet: Wallet, other: Wallet;
  let factory: AMMFactory;
  let amm: MockTimeAMM;

  let swapTarget: TestAMMCallee;

  let feeAmount: number;
  let tickSpacing: number;

  let minTick: number;
  let maxTick: number;

  let mint: MintFunction;
  let loadFixture: ReturnType<typeof createFixtureLoader>;

  let createAMM: ThenArg<ReturnType<typeof AMMFixture>>["createAMM"];

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      factory,
      swapTargetCallee: swapTarget,
      createAMM,
    } = await loadFixture(AMMFixture));

    const oldCreateAMM = createAMM;

    createAMM = async (
      _underlyingToken,
      _underlyingPool,
      _termInDays,
      _fee,
      _tickSpacing
    ) => {
      const amm = await oldCreateAMM(
        _underlyingToken,
        _underlyingPool,
        _termInDays,
        _fee,
        _tickSpacing
      );

      ({ mint } = createAMMFunctions({
        swapTarget,
        amm,
      }));
      minTick = getMinTick(_tickSpacing);
      maxTick = getMaxTick(_tickSpacing);
      feeAmount = _fee;
      tickSpacing = _tickSpacing;
      return amm;
    };

    // default to the 30 bips (Medium fee amount) amm
    amm = await createAMM(
      usdc_mainnet_addr,
      aave_lending_pool_addr,
      term_in_days,
      FeeAmount.MEDIUM,
      TICK_SPACINGS[FeeAmount.MEDIUM]
    );
  });

  it("constructor initializes immutables", async () => {
    expect(await amm.factory()).to.eq(factory.address);

    expect(await amm.underlyingToken()).to.eq(usdc_mainnet_addr);

    expect(await amm.underlyingPool()).to.eq(aave_lending_pool_addr);

    expect(await amm.termInDays()).to.eq(term_in_days);

    expect(await amm.fee()).to.eq(FeeAmount.MEDIUM);

    expect(await amm.tickSpacing()).to.eq(TICK_SPACINGS[FeeAmount.MEDIUM]);

    expect(await amm.maxLiquidityPerTick()).to.eq(
      getMaxLiquidityPerTick(tickSpacing)
    );
  });

  describe("#initialize", () => {
    it("fails if already initialized", async () => {
      await amm.initialize(encodeSqrtRatioX96(1, 1).toString());
      await expect(amm.initialize(encodeSqrtRatioX96(1, 1).toString())).to.be
        .reverted;
    });

    it("fails if starting price is too low", async () => {
      await expect(amm.initialize(1)).to.be.revertedWith("R");
      await expect(amm.initialize(MIN_SQRT_RATIO.sub(1))).to.be.revertedWith(
        "R"
      );
    });

    it("fails if starting price is too high", async () => {
      await expect(amm.initialize(MAX_SQRT_RATIO)).to.be.revertedWith("R");
      await expect(
        amm.initialize(BigNumber.from(2).pow(160).sub(1))
      ).to.be.revertedWith("R");
    });

    it("can be initialized at MIN_SQRT_RATIO", async () => {
      await amm.initialize(MIN_SQRT_RATIO);
      expect((await amm.slot0()).tick).to.eq(getMinTick(1));
    });

    it("can be initialized at MAX_SQRT_RATIO - 1", async () => {
      await amm.initialize(MAX_SQRT_RATIO.sub(1));
      expect((await amm.slot0()).tick).to.eq(getMaxTick(1) - 1);
    });

    it("sets initial variables", async () => {
      const price = encodeSqrtRatioX96(1, 2).toString();
      await amm.initialize(price);

      const { sqrtPriceX96 } = await amm.slot0();
      expect(sqrtPriceX96).to.eq(price);
      expect((await amm.slot0()).tick).to.eq(-6932);
    });

    it("emits a Initialized event with the input tick", async () => {
      const sqrtPriceX96 = encodeSqrtRatioX96(1, 2).toString();
      await expect(amm.initialize(sqrtPriceX96))
        .to.emit(amm, "Initialize")
        .withArgs(sqrtPriceX96, -6932);
    });
  });

  
  
  // describe("#swap", () => {

  //   beforeEach("initialize the amm and mint liquidity", async () => {
    
  //     await amm.initialize(encodeSqrtRatioX96(1, 10).toString()); // set this ratio according to the sqrtPriceMath numbers
  //     await mint(wallet.address, minTick, maxTick, 3161);
    
  //   })

    


  // })
  
  describe("#mint", () => {
    it("fails if not initialized", async () => {
      await expect(
        mint(wallet.address, -tickSpacing, tickSpacing, 1)
      ).to.be.revertedWith("LOK");
    });

    describe("after initialization", () => {
      beforeEach("initialize the amm at price of 10:1", async () => {
        await amm.initialize(encodeSqrtRatioX96(1, 10).toString());
        await mint(wallet.address, minTick, maxTick, 3161);
      });

      describe("success cases", () => {
        it("initial balances", async () => {
          expect(await amm.balance0()).to.eq(9996);
          expect(await amm.balance1()).to.eq(1000);
        });

        it("initial tick", async () => {
          expect((await amm.slot0()).tick).to.eq(-23028);
        });

        describe("above current price", () => {
          it("transfers token0 only", async () => {
            await mint(wallet.address, -22980, 0, 10000);

            expect(await amm.balance0()).to.eq(9996 + 21549);
            expect(await amm.balance1()).to.eq(1000);
          });

          it("max tick with max leverage", async () => {
            await mint(
              wallet.address,
              maxTick - tickSpacing,
              maxTick,
              BigNumber.from(2).pow(102)
            );
            expect(await amm.balance0()).to.eq(9996 + 828011525);
            expect(await amm.balance1()).to.eq(1000);
          });

          it("works for max tick", async () => {
            await mint(wallet.address, -22980, maxTick, 10000);
            expect(await amm.balance0()).to.eq(9996 + 31549);
            expect(await amm.balance1()).to.eq(1000);
          });
        });
      });

      describe("failure cases", () => {
        it("fails if tickLower greater than tickUpper", async () => {
          await expect(mint(wallet.address, 1, 0, 1)).to.be.reverted;
        });

        it("fails if tickLower less than min tick", async () => {
          await expect(mint(wallet.address, -887273, 0, 1)).to.be.reverted;
        });

        it("fails if tickUpper greater than max tick", async () => {
          await expect(mint(wallet.address, 0, 887273, 1)).to.be.reverted;
        });

        it("fails if amount exceeds the max", async () => {
          const maxLiquidityGross = await amm.maxLiquidityPerTick();
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.add(1)
            )
          ).to.be.reverted;
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross
            )
          ).to.not.be.reverted;
        });

        it("fails if total amount at tick exceeds the max", async () => {
          await mint(
            wallet.address,
            minTick + tickSpacing,
            maxTick - tickSpacing,
            1000
          );

          const maxLiquidityGross = await amm.maxLiquidityPerTick();
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.sub(1000).add(1)
            )
          ).to.be.reverted;
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing * 2,
              maxTick - tickSpacing,
              maxLiquidityGross.sub(1000).add(1)
            )
          ).to.be.reverted;
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing * 2,
              maxLiquidityGross.sub(1000).add(1)
            )
          ).to.be.reverted;
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.sub(1000)
            )
          ).to.not.be.reverted;
        });

        it("fails if amount is 0", async () => {
          await expect(
            mint(
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              0
            )
          ).to.be.reverted;
        });
      });
    });
  });
});
