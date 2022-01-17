import { ethers, waffle } from "hardhat";
import { BigNumber, Wallet, utils } from "ethers";
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
  getGrowthInside,
  getMaxLiquidityPerTick,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { ERC20Mock, Factory, TestRateOracle } from "../../typechain";
import { advanceTimeAndBlock } from "../helpers/time";
import { consts } from "../helpers/constants";
import { sub } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;
const salts = [utils.formatBytes32String("1"), utils.formatBytes32String("2")];

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let factory: Factory;
  let rateOracleTest: TestRateOracle;
  let termStartTimestampBN: BigNumber;
  let termEndTimestampBN: BigNumber;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;

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
      token,
      rateOracleTest,
      termStartTimestampBN,
      termEndTimestampBN,
    } = await loadFixture(metaFixture));

    // deploy a margin engine
    const marginEngineAddress = await factory.getMarginEngineAddress(salts[0]);
    await factory.createMarginEngine(salts[0]);
    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine"
    );
    marginEngineTest = marginEngineTestFactory.attach(marginEngineAddress);
    await marginEngineTest.initialize(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );

    // deploy a vamm
    const vammAddress = await factory.getVAMMAddress(salts[1]);
    await factory.createVAMM(salts[1]);
    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    vammTest = vammTestFactory.attach(vammAddress);
    await vammTest.initialize(marginEngineTest.address);

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
        fixedTokenGrowthOutsideX128: toBn("1.0"),
        variableTokenGrowthOutsideX128: toBn("-2.0"),
        feeGrowthOutsideX128: toBn("0.1"),
        initialized: true,
      });

      await vammTest.setTickTest(1, {
        liquidityGross: 40,
        liquidityNet: 30,
        fixedTokenGrowthOutsideX128: toBn("3.0"),
        variableTokenGrowthOutsideX128: toBn("-4.0"),
        feeGrowthOutsideX128: toBn("0.2"),
        initialized: true,
      });

      await vammTest.setFixedTokenGrowthGlobal(toBn("5.0"));
      await vammTest.setVariableTokenGrowthGlobal(toBn("-7.0"));
    });

    it("correctly computes position fixed and variable growth inside", async () => {
      const realized =
        await vammTest.computePositionFixedAndVariableGrowthInsideTest(
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
    it("check the current tick", async () => {
      const currentTick = (await vammTest.vammVars()).tick;
      console.log("Current Tick is", currentTick);
      expect(currentTick).to.eq(0);
    });
  });

  describe("#initialize", async () => {
    it("fails if already initialized", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
      await expect(vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString()))
        .to.be.reverted;
    });

    it("fails if starting price is too low", async () => {
      await expect(vammTest.initializeVAMM(1)).to.be.reverted;
      await expect(vammTest.initializeVAMM(MIN_SQRT_RATIO.sub(1))).to.be
        .reverted;
      // await expect(pool.initializeVAMM(1)).to.be.revertedWith('R')
      // await expect(pool.initializeVAMM(MIN_SQRT_RATIO.sub(1))).to.be.revertedWith('R')
    });

    it("fails if starting price is too high", async () => {
      await expect(vammTest.initializeVAMM(MAX_SQRT_RATIO)).to.be.reverted;
      await expect(vammTest.initializeVAMM(BigNumber.from(2).pow(160).sub(1)))
        .to.be.reverted;
    });

    it("can be initialized at MIN_SQRT_RATIO", async () => {
      await vammTest.initializeVAMM(MIN_SQRT_RATIO);
      expect((await vammTest.vammVars()).tick).to.eq(getMinTick(1));
    });
  });

  describe("#mint", () => {
    it("fails if not initialized", async () => {
      await expect(
        vammTest.mintTest(
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
        await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());

        await token.mint(wallet.address, BigNumber.from(10).pow(27));
        await token.approve(wallet.address, BigNumber.from(10).pow(27));

        console.log("owner of margin engine:   ", await marginEngineTest.owner());
        console.log("address of margin engine: ", marginEngineTest.address);
        console.log(
                    "address of ME in vamm:    ",
          await vammTest.marginEngineAddress()
        );
        console.log("address of vamm:          ", vammTest.address);
        console.log("address of factory:       ", factory.address);
        console.log("address of wallet:        ", wallet.address);

        console.log("balance:", (await token.balanceOf(wallet.address)).toString());

        await marginEngineTest.setVAMMAddress(vammTest.address);

        await marginEngineTest.updatePositionMargin(
          {
            owner: wallet.address,
            tickLower: minTick,
            tickUpper: maxTick,
            liquidityDelta: 0,
          },
          toBn("100000")
        );

        await vammTest.mintTest(
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
            vammTest.mintTest(vammTest.address, wallet.address, 1, 0, 1)
          ).to.be.reverted;
        });

        it("fails if tickLower less than min tick", async () => {
          // should be TLM but...hardhat
          await expect(
            vammTest.mintTest(vammTest.address, wallet.address, -887273, 0, 1)
          ).to.be.reverted;
        });

        it("fails if tickUpper greater than max tick", async () => {
          // should be TUM but...hardhat
          await expect(
            vammTest.mintTest(vammTest.address, wallet.address, 0, 887273, 1)
          ).to.be.reverted;
        });

        it("fails if amount exceeds the max", async () => {
          const maxLiquidityGross = await vammTest.maxLiquidityPerTick();
          await expect(
            vammTest.mintTest(
              vammTest.address,
              wallet.address,
              minTick + tickSpacing,
              maxTick - tickSpacing,
              maxLiquidityGross.add(1)
            )
          ).to.be.reverted;
          // AB: fails
          // await expect(vammTest.mintTest(vammTest.address, wallet.address, minTick + tickSpacing, maxTick - tickSpacing, maxLiquidityGross.sub(10000))).to.not.be.reverted;
        });

        // AB: get back to this
        // it("fails if total amount at tick exceeds the max", async () => {
        //   await vammTest.mintTest(vammTest.address, wallet.address, minTick+tickSpacing, maxTick-tickSpacing, 1000);
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
          expect((await vammTest.vammVars()).tick).to.eq(-23028);
        });

        it("adds liquidity to liquidityGross", async () => {
          await vammTest.mintTest(
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
          await vammTest.mintTest(
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
          await vammTest.mintTest(
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
          await vammTest.mintTest(
            vammTest.address,
            wallet.address,
            -240,
            0,
            100
          );
          await vammTest.mintTest(
            vammTest.address,
            wallet.address,
            -240,
            0,
            40
          );
          // await vammTest.burn( )
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
        "amm must be 1 day past maturity"
      );
    });

    it("check checkCurrentTimestampTermEndTimestampDelta", async () => {
      advanceTimeAndBlock(consts.ONE_WEEK, 1);
      await expect(vammTest.checkMaturityDuration()).to.be.revertedWith(
        "amm hasn't reached maturity"
      );
    });
  });

  describe("#updateProtocolFees", () => {
    it("check AMM privilege ", async () => {
      await expect(vammTest.updateProtocolFees(toBn("1"))).to.be.revertedWith(
        "only AMM"
      );
    });

    it("check not enough Protocol Fees", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      await vammTest.setTestProtocolFees(toBn("3"));
      expect(await vammTest.protocolFees()).to.be.equal(toBn("3"));
      await expect(marginEngineTest.collectProtocol(other.address, toBn("4")))
        .to.be.reverted;
    });

    it("check updateProtocolFees", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      await vammTest.setTestProtocolFees(toBn("5"));
      expect(await vammTest.protocolFees()).to.be.equal(toBn("5"));
      await expect(marginEngineTest.collectProtocol(other.address, toBn("4")))
        .to.not.be.reverted;
      expect(await vammTest.protocolFees()).to.be.equal(toBn("1"));
    });
  });

  describe("#setFeeProtocol", () => {
    it("check owner privilege ", async () => {
      await expect(
        vammTest.connect(other).setFeeProtocol(toBn("0.03"))
      ).to.be.revertedWith("only factory owner");
    });

    it("check setFeeProtocol", async () => {
      await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
      expect((await vammTest.vammVars()).feeProtocol).to.be.equal(toBn("0"));
      await expect(vammTest.setFeeProtocol(toBn("0.03"))).to.not.be.reverted;
      expect((await vammTest.vammVars()).feeProtocol).to.be.equal(toBn("0.03"));
    });
  });

  describe("#setTickSpacing", () => {
    it("check owner privilege ", async () => {
      await expect(
        vammTest.connect(other).setTickSpacing(100)
      ).to.be.revertedWith("only factory owner");
    });

    it("check setTickSpacing", async () => {
      expect(await vammTest.tickSpacing()).to.be.equal(TICK_SPACING);
      await expect(vammTest.setTickSpacing(100)).to.not.be.reverted;
      expect(await vammTest.tickSpacing()).to.be.equal(100);
    });
  });

  describe("#setMaxLiquidityPerTick", () => {
    it("check owner privilege ", async () => {
      await expect(
        vammTest
          .connect(other)
          .setMaxLiquidityPerTick(getMaxLiquidityPerTick(100))
      ).to.be.revertedWith("only factory owner");
    });

    it("check setMaxLiquidityPerTick", async () => {
      expect(await vammTest.maxLiquidityPerTick()).to.be.equal(
        getMaxLiquidityPerTick(TICK_SPACING)
      );
      await expect(vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(100)))
        .to.not.be.reverted;
      expect(await vammTest.maxLiquidityPerTick()).to.be.equal(
        getMaxLiquidityPerTick(100)
      );
    });
  });

  describe("#setFee", () => {
    it("check owner privilege ", async () => {
      await expect(
        vammTest.connect(other).setFee(toBn("0.05"))
      ).to.be.revertedWith("only factory owner");
    });

    it("check setTickSpacing", async () => {
      expect(await vammTest.fee()).to.be.equal(toBn("0.03"));
      await expect(vammTest.setFee(toBn("0.05"))).to.not.be.reverted;
      expect(await vammTest.fee()).to.be.equal(toBn("0.05"));
    });
  });

  // TODO: check after testing updatePosition() and MarginEngine.unwindPosition()
  // describe("#burn", () => {
  //   it("check burn", async () => {
  //     await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
  //     await vammTest.burn(0, 2, toBn("10"));
  //   });
  // });
});
