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
} from "../shared/utilities";
import { TickMath } from "../shared/tickMath";
import { mul, sub } from "../shared/functions";

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

    await token.mint(wallet.address, BigNumber.from(10).pow(27));
    await token
      .connect(wallet)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));
    await token.mint(other.address, BigNumber.from(10).pow(27));
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
  });

  it("approvals work as expected", async () => {
    let isApproved = await factory.isApproved(
      wallet.address,
      periphery.address
    );
    expect(isApproved).to.eq(false);
    await factory.connect(wallet).setApproval(periphery.address, true);
    isApproved = await factory.isApproved(wallet.address, periphery.address);
    expect(isApproved).to.eq(true);
    await factory.connect(wallet).setApproval(periphery.address, false);
    isApproved = await factory.isApproved(wallet.address, periphery.address);
    expect(isApproved).to.eq(false);
  });

  it("minting via periphery", async () => {
    await factory.connect(wallet).setApproval(periphery.address, true);

    await vammTest.initializeVAMM(
      TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString()
    );

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("100000")
    );

    const notionalMinted = toBn("10");

    await periphery.mintOrBurn({
      marginEngineAddress: marginEngineTest.address,
      recipient: wallet.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalMinted,
      isMint: true,
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
      isExternal: false,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
    });

    await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      false
    );

    const lpInfo = await marginEngineTest.getPosition(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING
    );
    const lpVariableTokenBalance = lpInfo.variableTokenBalance;

    const traderInfo = await marginEngineTest.getPosition(
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

    expect(lpVariableTokenBalance).to.be.closeTo(notionalMinted, 2);
    expect(traderVariableTokenBalance).to.be.closeTo(
      mul(notionalMinted, toBn("-1")),
      2
    );
  });

  it("burning via periphery", async () => {
    await vammTest.initializeVAMM(
      TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString()
    );

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("100000")
    );

    const notionalMinted = toBn("10");
    const notionalBurnt = toBn("5");
    const notioanlLeft = sub(notionalMinted, notionalBurnt);

    await expect(
      periphery.mintOrBurn({
        marginEngineAddress: marginEngineTest.address,
        recipient: wallet.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        notional: notionalMinted,
        isMint: true,
      })
    ).to.be.revertedWith("only msg.sender or approved can mint");

    await factory.connect(wallet).setApproval(periphery.address, true);

    await periphery.mintOrBurn({
      marginEngineAddress: marginEngineTest.address,
      recipient: wallet.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalMinted,
      isMint: true,
    });

    await periphery.mintOrBurn({
      marginEngineAddress: marginEngineTest.address,
      recipient: wallet.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalBurnt,
      isMint: false,
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
      isExternal: false,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
    });

    await marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      false
    );

    const lpInfo = await marginEngineTest.getPosition(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING
    );
    const lpVariableTokenBalance = lpInfo.variableTokenBalance;

    const traderInfo = await marginEngineTest.getPosition(
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

    expect(lpVariableTokenBalance).to.be.closeTo(notioanlLeft, 10);
    expect(traderVariableTokenBalance).to.be.closeTo(
      mul(notioanlLeft, toBn("-1")),
      2
    );
  });

  it("swapping via periphery", async () => {
    await factory.connect(wallet).setApproval(periphery.address, true);
    await factory.connect(other).setApproval(periphery.address, true);

    await vammTest.initializeVAMM(
      TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString()
    );

    await marginEngineTest.updatePositionMargin(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING,
      toBn("100000")
    );

    const notionalMinted = toBn("10");

    await periphery.mintOrBurn({
      marginEngineAddress: marginEngineTest.address,
      recipient: wallet.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: notionalMinted,
      isMint: true,
    });

    await marginEngineTest
      .connect(other)
      .updatePositionMargin(
        other.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("100000")
      );

    await expect(
      periphery.connect(wallet).swap({
        marginEngineAddress: marginEngineTest.address,
        recipient: other.address,
        isFT: true,
        notional: toBn("10"),
        sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
      })
    ).to.be.revertedWith("msg.sender must be the recipient");

    await periphery.connect(other).swap({
      marginEngineAddress: marginEngineTest.address,
      recipient: other.address,
      isFT: true,
      notional: toBn("10"),
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

    const lpInfo = await marginEngineTest.getPosition(
      wallet.address,
      -TICK_SPACING,
      TICK_SPACING
    );
    const lpVariableTokenBalance = lpInfo.variableTokenBalance;

    const traderInfo = await marginEngineTest.getPosition(
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

    expect(lpVariableTokenBalance).to.be.closeTo(notionalMinted, 2);
    expect(traderVariableTokenBalance).to.be.closeTo(
      mul(notionalMinted, toBn("-1")),
      2
    );
  });
});
