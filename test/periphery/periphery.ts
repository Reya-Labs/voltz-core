import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
import { toBn } from "evm-bn";
import { rawDecode } from "ethereumjs-abi";
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

  it("swap quoter on revert: margin requirement not met", async () => {
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

  // const decodeError = (error: string): string => {
  //   const buffer = Buffer.from(error, "utf-8");
  //   console.log(buffer.slice(4));
  //   const decoded = rawDecode(["string"], buffer.slice(4));
  //   return decoded.toString();
  // };

  it.only("here", async () => {
    const error =
      "0x6b4fff2400000000000000000000000000000000000000000000000000000000007c3344";

    const iface = new ethers.utils.Interface([
      /// @dev No need to unwind a net zero position
      "error PositionNetZero()",
      "error MarginLessThanMinimum(int256 marginRequirement)",

      /// @dev We can't withdraw more margin than we have
      "error WithdrawalExceedsCurrentMargin()",

      /// @dev Position must be settled after AMM has reached maturity
      "error PositionNotSettled()",

      /// The resulting margin does not meet minimum requirements
      "error MarginRequirementNotMet(int256 marginRequirement,int24 tick,int256 fixedTokenDelta,int256 variableTokenDelta,uint256 cumulativeFeeIncurred,int256 fixedTokenDeltaUnbalanced)",

      /// The position/trader needs to be below the liquidation threshold to be liquidated
      "error CannotLiquidate()",

      /// Only the position/trade owner can update the LP/Trader margin
      "error OnlyOwnerCanUpdatePosition()",

      "error OnlyVAMM()",

      "error OnlyFCM()",

      /// Margin delta must not equal zero
      "error InvalidMarginDelta()",

      /// Positions and Traders cannot be settled before the applicable interest rate swap has matured
      "error CannotSettleBeforeMaturity()",

      "error closeToOrBeyondMaturity()",

      /// @dev There are not enough funds available for the requested operation
      "error NotEnoughFunds(uint256 requested, uint256 available)",

      /// @dev The two values were expected to have oppostite sigs, but do not
      "error ExpectedOppositeSigns(int256 amount0, int256 amount1)",

      /// @dev Error which is reverted if the sqrt price of the vamm is non-zero before a vamm is initialized
      "error ExpectedSqrtPriceZeroBeforeInit(uint160 sqrtPriceX96)",

      /// @dev Error which ensures the liquidity delta is positive if a given LP wishes to mint further liquidity in the vamm
      "error LiquidityDeltaMustBePositiveInMint(uint128 amount)",

      /// @dev Error which ensures the liquidity delta is positive if a given LP wishes to burn liquidity in the vamm
      "error LiquidityDeltaMustBePositiveInBurn(uint128 amount)",

      /// @dev Error which ensures the amount of notional specified when initiating an IRS contract (via the swap function in the vamm) is non-zero
      "error IRSNotionalAmountSpecifiedMustBeNonZero()",

      /// @dev Error which ensures the VAMM is unlocked
      "error CanOnlyTradeIfUnlocked(bool unlocked)",

      /// @dev only the margin engine can run a certain function
      "error OnlyMarginEngine()",

      /// The resulting margin does not meet minimum requirements
      "error MarginRequirementNotMetFCM(int256 marginRequirement)",

      /// @dev getReserveNormalizedIncome() returned zero for underlying asset. Oracle only supports active Aave-V2 assets.
      "error AavePoolGetReserveNormalizedIncomeReturnedZero()",

      /// @dev currentTime < queriedTime
      "error OOO()",
    ]);

    try {
      const result = iface.decodeErrorResult(
        "MarginRequirementNotMetFCM",
        error
      );
      console.log(result);
    } catch (_) {}

    // const encoded = ethers.utils.defaultAbiCoder.encode(
    //   ["MarginRequirementNotMet(uint256)", "uint256"],
    //   [1]
    // );
    // console.log(encoded);

    // const error =
    //   "Reverted 0x6b4fff2400000000000000000000000000000000000000000000000000000000007c3344";
    // const error =
    //   "Reverted 0x43f2832100000000000000000000000000000000000000000000000000000000001ab753ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffca0f00000000000000000000000000000000000000000000000000000000dc5555e9ffffffffffffffffffffffffffffffffffffffffffffffffffffffffc4653600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f572e5b8";
    // const rawReason = error.toString();
    // console.log("reason:", rawReason);
    // const reasonWithSignature = rawReason.replace("Reverted ", "");
    // const selector = reasonWithSignature.slice(2, 10);
    // const reasonWithoutSignature =
    //   reasonWithSignature.slice(0, 2) + reasonWithSignature.slice(10);
    // console.log(selector);
    // console.log(reasonWithoutSignature);
    // if (selector === "6b4fff24") {
    //   const args = ethers.utils.defaultAbiCoder.decode(
    //     ["uint256"],
    //     reasonWithoutSignature
    //   );
    //   console.log(args.toString());
    //   console.log("MarginLessThanMinimum(" + args.toString() + ")");
    // }
    // if (selector === "43f28321") {
    //   const args = ethers.utils.defaultAbiCoder.decode(
    //     ["tuple(int256,int24,int256,int256,uint256,int256)"],
    //     reasonWithoutSignature
    //   );
    //   console.log(args.toString());
    //   return (
    //     "MarginRequirementNotMet(" +
    //     args[0][0].toString() +
    //     "," +
    //     args[0][1].toString() +
    //     "," +
    //     args[0][2].toString() +
    //     "," +
    //     args[0][3].toString() +
    //     "," +
    //     args[0][4].toString() +
    //     "," +
    //     args[0][5].toString() +
    //     ")"
    //   );
    // }
    // const err =
    //   "0x6b4fff2400000000000000000000000000000000000000000000000000000000000c6adc";
    // const errWithNoSignature =
    //   "0x00000000000000000000000000000000000000000000000000000000000c6adc";
    // console.log(decodeError(err));
    // console.log(
    //   utils.defaultAbiCoder.decode(["uint256"], errWithNoSignature).toString()
    // );
    // console.log(utils.defaultAbiCoder.encode(["uint256"], [1000000]));
    // console.log(errWithNoSignature);
    // const reasonWithSignature =
    //   "0x6b4fff2400000000000000000000000000000000000000000000000000000012bc589604";
    // const reason =
    //   "0x0000000000000000000000000000000000000000000000000000000000000012bc589604";
    // const reason =
    //   "0x00000000000000000000000000000000000000000000000000000000000004d20000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000b48656c6c6f20576f726c64000000000000000000000000000000000000000000";
    // console.log(utils.formatBytes32String)
  });
});
