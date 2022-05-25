import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { toBn } from "evm-bn";
import {
  ERC20Mock,
  Factory,
  Periphery,
  TestMarginEngine,
  TestVAMM,
} from "../../typechain";
import {
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
  TICK_SPACING,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
} from "../shared/utilities";
import { TickMath } from "../shared/tickMath";
import { mul } from "../shared/functions";

const createFixtureLoader = waffle.createFixtureLoader;

// todo: test scenario with two vamms, two caps, two position snapshot mappings effectively

describe("Periphery", async () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let periphery: Periphery;
  let factory: Factory;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ token, vammTest, marginEngineTest, factory } = await loadFixture(
      metaFixture
    ));

    await token.mint(wallet.address, BigNumber.from(10).pow(27).mul(2));

    await token
      .connect(wallet)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    await token.mint(other.address, BigNumber.from(10).pow(27).mul(2));

    await token
      .connect(other)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

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
      minMarginToIncentiviseLiquidators: 0,
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);

    // deploy the periphery
    const peripheryFactory = await ethers.getContractFactory("Periphery");

    periphery = (await peripheryFactory.deploy()) as Periphery;

    // set the periphery in the factory
    await expect(factory.setPeriphery(periphery.address))
      .to.emit(factory, "PeripheryUpdate")
      .withArgs(periphery.address);

    // approve the periphery to spend tokens on wallet's behalf

    await token
      .connect(wallet)
      .approve(periphery.address, BigNumber.from(10).pow(27));

    await token
      .connect(other)
      .approve(periphery.address, BigNumber.from(10).pow(27));
  });

  it("set lp margin cap works as expected with margin engine owner", async () => {
    await expect(periphery.setLPMarginCap(vammTest.address, toBn("10")))
      .to.emit(periphery, "MarginCap")
      .withArgs(vammTest.address, toBn("10"));
  });

  it("set lp margin reverts if invoked by a non-owner", async () => {
    await expect(
      periphery
        .connect(other)
        .setLPMarginCap(marginEngineTest.address, toBn("10"))
    ).to.be.revertedWith("only vamm owner");
  });

  it("an lp deposits margin through margin engine, then tries to go over limit", async () => {
    await periphery.setLPMarginCap(vammTest.address, toBn("10"));

    await marginEngineTest
      .connect(wallet)
      .updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("11")
      );

    await expect(
      periphery.connect(wallet).mintOrBurn({
        marginEngine: marginEngineTest.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("2"),
        isMint: true,
        marginDelta: 0,
      })
    ).to.be.revertedWith("lp cap limit");
  });

  it("an lp mints, burns, deposits, remints", async () => {
    await periphery.setLPMarginCap(vammTest.address, toBn("10"));

    await vammTest.setIsAlpha(true);

    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await expect(
      vammTest.mint(wallet.address, -TICK_SPACING, TICK_SPACING, 2)
    ).to.be.revertedWith("periphery only");

    await periphery.connect(wallet).mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("2"),
      isMint: true,
      marginDelta: toBn("9"),
    });

    await expect(
      vammTest.burn(wallet.address, -TICK_SPACING, TICK_SPACING, 2)
    ).to.be.revertedWith("periphery only");

    await periphery.connect(wallet).mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("2"),
      isMint: false,
      marginDelta: 0,
    });

    await marginEngineTest
      .connect(wallet)
      .updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("11")
      );

    await expect(
      periphery.connect(wallet).mintOrBurn({
        marginEngine: marginEngineTest.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("2"),
        isMint: true,
        marginDelta: 0,
      })
    ).to.be.revertedWith("lp cap limit");
  });

  it("an lp cannot deposit more margin via margin engine after minting via periphery", async () => {
    await periphery.setLPMarginCap(vammTest.address, toBn("10"));

    await vammTest.setIsAlpha(true);
    await marginEngineTest.setIsAlpha(true);

    await periphery.connect(wallet).mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("2"),
      isMint: true,
      marginDelta: toBn("9"),
    });

    await expect(
      marginEngineTest
        .connect(wallet)
        .updatePositionMargin(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING,
          toBn("2")
        )
    ).to.be.revertedWith("periphery only");
  });

  it("check can't mint beyond the margin cap", async () => {
    await periphery.setLPMarginCap(vammTest.address, toBn("10"));

    await periphery.mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("9"),
      isMint: true,
      marginDelta: toBn("9"),
    });

    await expect(
      periphery.mintOrBurn({
        marginEngine: marginEngineTest.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("2"),
        isMint: true,
        marginDelta: toBn("2"),
      })
    ).to.be.revertedWith("lp cap limit");
  });

  it("lp cannot swap via the periphery", async () => {
    await vammTest.setIsAlpha(true);
    await marginEngineTest.setIsAlpha(true);

    await periphery.connect(wallet).mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("9"),
      isMint: true,
      marginDelta: toBn("9"),
    });

    await expect(
      periphery.connect(wallet).swap({
        marginEngine: marginEngineTest.address,
        isFT: false,
        notional: toBn("10000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        marginDelta: toBn("1000"),
      })
    ).to.be.revertedWith("lp swap alpha");
  });

  it("check can't mint beyond the notional cap", async () => {
    await periphery.setLPMarginCap(marginEngineTest.address, toBn("10"));

    await periphery.mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("9"),
      isMint: true,
      marginDelta: toBn("10"),
    });

    await periphery.mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("9"),
      isMint: false,
      marginDelta: toBn("0"),
    });

    await expect(
      periphery.mintOrBurn({
        marginEngine: marginEngineTest.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("2"),
        isMint: true,
        marginDelta: toBn("10"),
      })
    ).to.not.be.reverted;
  });

  it("alpha state can only be set by the owner of the vamm", async () => {
    await expect(vammTest.connect(other).setIsAlpha(true)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    const isAlpha = await vammTest.isAlpha();
    expect(isAlpha).to.eq(false);

    await expect(vammTest.setIsAlpha(true))
      .to.emit(vammTest, "IsAlpha")
      .withArgs(true);

    await expect(vammTest.setIsAlpha(true)).to.be.revertedWith(
      "alpha state already set"
    );
  });

  it("can't mint or burn with vamm when alpha but can mint with periphery", async () => {
    await vammTest.setIsAlpha(true);

    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await expect(
      vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("10000000")
      )
    ).to.be.revertedWith("periphery only");

    await expect(
      vammTest.burn(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("10000000")
      )
    ).to.be.revertedWith("periphery only");
  });

  it("swap quoter on revert: margin requirement not met", async () => {
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );
    await vammTest
      .connect(wallet)
      .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

    const tickBefore = await vammTest.getCurrentTick();
    let marginRequirement: number = 0;
    let tickAfter: number = 0;
    let fixedTokenDelta: number = 0;
    let variableTokenDelta: number = 0;
    let feeIncured: number = 0;
    let fixedTokenDeltaUnbalanced: number = 0;

    await periphery
      .connect(other)
      .callStatic.swap({
        marginEngine: marginEngineTest.address,
        isFT: false,
        notional: toBn("10000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: 0,
        tickUpper: 0,
        marginDelta: 0,
      })
      .then(
        async (result) => {
          marginRequirement = parseFloat(utils.formatEther(result[4]));
          tickAfter = await vammTest.getCurrentTick();
          fixedTokenDelta = parseFloat(utils.formatEther(result[0]));
          variableTokenDelta = parseFloat(utils.formatEther(result[1]));
          feeIncured = parseFloat(utils.formatEther(result[2]));
          fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(result[3]));
        },
        (error) => {
          if (error.message.includes("MarginRequirementNotMet")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
            tickAfter = parseInt(args[1]);
            fixedTokenDelta = parseFloat(utils.formatEther(args[2]));
            variableTokenDelta = parseFloat(utils.formatEther(args[3]));
            feeIncured = parseFloat(utils.formatEther(args[4]));
            fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(args[5]));
          } else {
            console.error(error.message);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
    console.log("                 tick before:", tickBefore);
    console.log("                  tick after:", tickAfter);
    console.log("           fixed token delta:", fixedTokenDelta);
    console.log("        variable token delta:", variableTokenDelta);
    console.log("                fee incurred:", feeIncured);
    console.log("fixed token delta unbalanced:", fixedTokenDeltaUnbalanced);
  });

  it("swap quoter on success", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );

    await marginEngineTest.updatePositionMargin(
      other.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );

    await vammTest
      .connect(wallet)
      .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

    const tickBefore = await vammTest.getCurrentTick();
    let marginRequirement: number = 0;
    let tickAfter: number = 0;
    let fixedTokenDelta: number = 0;
    let variableTokenDelta: number = 0;
    let feeIncured: number = 0;
    let fixedTokenDeltaUnbalanced: number = 0;

    await periphery
      .connect(other)
      .callStatic.swap({
        marginEngine: marginEngineTest.address,
        isFT: false,
        notional: toBn("10000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        marginDelta: 0,
      })
      .then(
        async (result) => {
          marginRequirement = parseFloat(utils.formatEther(result[4]));
          tickAfter = await vammTest.getCurrentTick();
          fixedTokenDelta = parseFloat(utils.formatEther(result[0]));
          variableTokenDelta = parseFloat(utils.formatEther(result[1]));
          feeIncured = parseFloat(utils.formatEther(result[2]));
          fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(result[3]));
        },
        (error) => {
          if (error.message.includes("MarginRequirementNotMet")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
            tickAfter = parseInt(args[1]);
            fixedTokenDelta = parseFloat(utils.formatEther(args[2]));
            variableTokenDelta = parseFloat(utils.formatEther(args[3]));
            feeIncured = parseFloat(utils.formatEther(args[4]));
            fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(args[5]));
          } else {
            console.error(error.message);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
    console.log("                 tick before:", tickBefore);
    console.log("                  tick after:", tickAfter);
    console.log("           fixed token delta:", fixedTokenDelta);
    console.log("        variable token delta:", variableTokenDelta);
    console.log("                fee incurred:", feeIncured);
    console.log("fixed token delta unbalanced:", fixedTokenDeltaUnbalanced);
  });

  it("swap quoter on different revert", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );
    await vammTest
      .connect(wallet)
      .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

    const tickBefore = await vammTest.getCurrentTick();
    let marginRequirement: number = 0;
    let tickAfter: number = 0;
    let fixedTokenDelta: number = 0;
    let variableTokenDelta: number = 0;
    let feeIncured: number = 0;
    let fixedTokenDeltaUnbalanced: number = 0;

    await periphery
      .connect(other)
      .callStatic.swap({
        marginEngine: marginEngineTest.address,
        isFT: false,
        notional: toBn("0"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: 0,
        tickUpper: 0,
        marginDelta: 0,
      })
      .then(
        async (result) => {
          marginRequirement = parseFloat(utils.formatEther(result[4]));
          tickAfter = await vammTest.getCurrentTick();
          fixedTokenDelta = parseFloat(utils.formatEther(result[0]));
          variableTokenDelta = parseFloat(utils.formatEther(result[1]));
          feeIncured = parseFloat(utils.formatEther(result[2]));
          fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(result[3]));
        },
        (error) => {
          if (error.message.includes("MarginRequirementNotMet")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
            tickAfter = parseInt(args[1]);
            fixedTokenDelta = parseFloat(utils.formatEther(args[2]));
            variableTokenDelta = parseFloat(utils.formatEther(args[3]));
            feeIncured = parseFloat(utils.formatEther(args[4]));
            fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(args[5]));
          } else {
            console.error(error.message);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
    console.log("                 tick before:", tickBefore);
    console.log("                  tick after:", tickAfter);
    console.log("           fixed token delta:", fixedTokenDelta);
    console.log("        variable token delta:", variableTokenDelta);
    console.log("                fee incurred:", feeIncured);
    console.log("fixed token delta unbalanced:", fixedTokenDeltaUnbalanced);
  });

  it("mint quoter on revert", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    let marginRequirement: number = 0;
    await periphery
      .connect(wallet)
      .callStatic.mintOrBurn({
        marginEngine: marginEngineTest.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("59997"), // equivalent to approximately 10,000,000 liquidity
        isMint: true,
        marginDelta: 0,
      })
      .then(
        (result) => {
          console.log("on success");
          marginRequirement = parseFloat(utils.formatEther(result));
        },
        (error) => {
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");
            marginRequirement = parseFloat(utils.formatEther(args[0]));
          } else {
            console.error(error);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
  });

  it("mint quoter on success", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );

    let marginRequirement: number = 0;
    await periphery
      .connect(wallet)
      .callStatic.mintOrBurn({
        marginEngine: marginEngineTest.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("59997"), // equivalent to approximately 10,000,000 liquidity
        isMint: true,
        marginDelta: 0,
      })
      .then(
        (result) => {
          console.log("on success");
          marginRequirement = parseFloat(utils.formatEther(result));
        },
        (error) => {
          console.log("on revert");
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
          } else {
            console.error(error);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
  });

  it("mint quoter from vamm", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );

    let marginRequirement: number = 0;
    await vammTest
      .connect(wallet)
      .callStatic.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("10000000")
      )
      .then(
        (result) => {
          console.log("on success");
          marginRequirement = parseFloat(utils.formatEther(result));
        },
        (error) => {
          console.log("on revert");
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
          } else {
            console.error(error);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
  });

  it("mint quoter on different revert", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    let marginRequirement: number = 0;
    await periphery
      .connect(wallet)
      .callStatic.mintOrBurn({
        marginEngine: marginEngineTest.address,

        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: toBn("0"),
        isMint: true,
        marginDelta: 0,
      })
      .then(
        (result) => {
          console.log("on success");
          marginRequirement = parseFloat(utils.formatEther(result));
        },
        (error) => {
          console.log("on revert");
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
          } else {
            console.error(error);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
  });

  it("update position margin on revert", async () => {
    // await factory.connect(wallet).setApproval(periphery.address, true);
    // await factory.connect(other).setApproval(periphery.address, true);
    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("1000")
    );

    await vammTest
      .connect(wallet)
      .mint(wallet.address, -TICK_SPACING, TICK_SPACING, toBn("10000000"));

    let marginRequirement: number = 0;
    await marginEngineTest.callStatic
      .updatePositionMargin(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("-999")
      )
      .then(
        (_) => {
          console.log("on success");
        },
        (error) => {
          console.log("on revert");
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = parseFloat(utils.formatEther(args[0]));
          } else {
            console.error(error);
          }
        }
      );

    console.log("          margin requirement:", marginRequirement);
  });

  it("approvals work as expected", async () => {
    let isApproved = await factory.isApproved(wallet.address, other.address);
    expect(isApproved).to.eq(false);
    await factory.connect(wallet).setApproval(other.address, true);
    isApproved = await factory.isApproved(wallet.address, other.address);
    expect(isApproved).to.eq(true);
    await factory.connect(wallet).setApproval(other.address, false);
    isApproved = await factory.isApproved(wallet.address, other.address);
    expect(isApproved).to.eq(false);
  });

  it("minting via periphery", async () => {
    const notionalMinted = toBn("10");

    await periphery.connect(wallet).mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalMinted,
      isMint: true,
      marginDelta: toBn("100000"),
    });

    await marginEngineTest
      .connect(other)
      .updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );
    await vammTest.connect(other).swap({
      recipient: other.address,
      amountSpecified: mul(notionalMinted, toBn("10")), // trying to swap more than available
      sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),

      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
    });

    await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      false
    );

    const lpInfo = await marginEngineTest.callStatic.getPosition(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING
    );
    const lpVariableTokenBalance = lpInfo.variableTokenBalance;

    const traderInfo = await marginEngineTest.callStatic.getPosition(
      other.address,
      -TICK_SPACING,
      TICK_SPACING
    );

    const traderVariableTokenBalance = traderInfo.variableTokenBalance;

    console.log(
      "lpVariableTokenBalance",
      utils.formatEther(lpVariableTokenBalance.toString())
    );

    console.log(
      "traderVariableTokenBalance",
      utils.formatEther(traderVariableTokenBalance.toString())
    );

    expect(lpVariableTokenBalance).to.be.closeTo("5007499619400846835", 10);
    expect(traderVariableTokenBalance).to.be.closeTo(
      "-5007499619400846838",
      10
    );
  });

  it("burning via periphery", async () => {
    const notionalMinted = toBn("10");
    const notionalBurnt = toBn("5");

    await periphery.mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalMinted,
      isMint: true,
      marginDelta: toBn("100000"),
    });

    await periphery.mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalBurnt,
      isMint: false,
      marginDelta: 0,
    });

    await marginEngineTest
      .connect(other)
      .updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );
    await vammTest.connect(other).swap({
      recipient: other.address,
      amountSpecified: mul(notionalMinted, toBn("10")), // trying to swap more than available
      sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
    });

    await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      false
    );

    const lpInfo = await marginEngineTest.callStatic.getPosition(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING
    );
    const lpVariableTokenBalance = lpInfo.variableTokenBalance;

    const traderInfo = await marginEngineTest.callStatic.getPosition(
      other.address,
      -TICK_SPACING,
      TICK_SPACING
    );

    const traderVariableTokenBalance = traderInfo.variableTokenBalance;

    console.log(
      "lpVariableTokenBalance",
      utils.formatEther(lpVariableTokenBalance.toString())
    );

    console.log(
      "traderVariableTokenBalance",
      utils.formatEther(traderVariableTokenBalance.toString())
    );

    expect(lpVariableTokenBalance).to.be.closeTo("2503749809700423415", 10);
    expect(traderVariableTokenBalance).to.be.closeTo(
      "-2503749809700423415",
      10
    );
  });

  it("swapping via periphery", async () => {
    const notionalMinted = toBn("10");

    await periphery.mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalMinted,
      isMint: true,
      marginDelta: toBn("100000"),
    });

    await marginEngineTest
      .connect(other)
      .updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );

    await periphery.connect(other).swap({
      marginEngine: marginEngineTest.address,
      isFT: true,
      notional: toBn("10"),
      sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: 0,
    });

    await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      false
    );

    const lpInfo = await marginEngineTest.callStatic.getPosition(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING
    );
    const lpVariableTokenBalance = lpInfo.variableTokenBalance;

    const traderInfo = await marginEngineTest.callStatic.getPosition(
      other.address,
      -TICK_SPACING,
      TICK_SPACING
    );

    const traderVariableTokenBalance = traderInfo.variableTokenBalance;

    console.log(
      "lpVariableTokenBalance",
      utils.formatEther(lpVariableTokenBalance.toString())
    );

    console.log(
      "traderVariableTokenBalance",
      utils.formatEther(traderVariableTokenBalance.toString())
    );

    expect(lpVariableTokenBalance).to.be.closeTo("5007499619400846835", 10);
    expect(traderVariableTokenBalance).to.be.closeTo(
      "-5007499619400846835",
      10
    );
  });
});
