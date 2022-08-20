import { expect } from "chai";
import { waffle } from "hardhat";
import { BigNumber, Wallet } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import {
  advanceTimeAndBlock,
  getCurrentTimestamp,
} from "../../../helpers/time";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodeSqrtRatioX96,
  MAX_SQRT_RATIO,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  MIN_SQRT_RATIO,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { IVAMM, IMarginEngine } from "../../../../typechain";

const { provider } = waffle;

const MAX_AMOUNT = BigNumber.from(10).pow(27);

const e2eParamsStableCoin: e2eParameters = {
  duration: consts.ONE_MONTH,
  numActors: 5,
  marginCalculatorParams: {
    apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
    apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
    minDeltaLMWad: MIN_DELTA_LM,
    minDeltaIMWad: MIN_DELTA_IM,
    sigmaSquaredWad: toBn("0.15"),
    alphaWad: ALPHA,
    betaWad: BETA,
    xiUpperWad: XI_UPPER,
    xiLowerWad: XI_LOWER,
    tMaxWad: T_MAX,

    etaIMWad: toBn("0.002"),
    etaLMWad: toBn("0.001"),

    gammaWad: toBn("1.0"),
    minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
  },
  lookBackWindowAPY: consts.ONE_WEEK,
  startingPrice: encodeSqrtRatioX96(1, 1),
  feeProtocol: 0,
  fee: toBn("0"),
  tickSpacing: TICK_SPACING,
  positions: [
    [0, -TICK_SPACING, TICK_SPACING],
    [1, -3 * TICK_SPACING, -TICK_SPACING],
    [2, -TICK_SPACING, TICK_SPACING],
    [3, -TICK_SPACING, TICK_SPACING],
    [4, -TICK_SPACING, TICK_SPACING],
  ],
  isWETH: false,
  rateOracle: 1,
};

class ScenarioRunnerStableCoin extends ScenarioRunner {
  wallets!: Wallet[];

  override async run() {
    await this.factory.setPeriphery(this.periphery.address);

    await this.vamm.setIsAlpha(true);
    await this.marginEngine.setIsAlpha(true);
    await this.periphery.setLPMarginCap(this.vamm.address, toBn("4000"));

    this.wallets = [];
    for (let i = 0; i < this.params.numActors; i++) {
      const wallet = await provider.getWallets()[i];
      await this.token.mint(wallet.address, MAX_AMOUNT);
      await this.token
        .connect(wallet)
        .approve(this.periphery.address, MAX_AMOUNT);
      this.wallets.push(wallet);
    }

    // provide enough margin for pool to allow rollovers
    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[4][1],
        tickUpper: this.positions[4][2],
        notional: toBn("6000"),
        isMint: true,
        marginDelta: toBn("2100"),
      };

      await this.periphery
        .connect(this.wallets[4])
        .mintOrBurn(mintOrBurnParameters);
    }

    // LP position
    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: toBn("6000"),
        isMint: true,
        marginDelta: toBn("210"),
      };

      await this.periphery
        .connect(this.wallets[0])
        .mintOrBurn(mintOrBurnParameters);
    }

    // trader 2 buys 2,995 VT
    {
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: false,
        notional: toBn("2995"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
        marginDelta: toBn("1000"),
      };

      await this.periphery.connect(this.wallets[2]).swap(swapParameters);
    }

    // trader 3 buys 100 FT
    {
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: true,
        notional: toBn("100"),
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: this.positions[3][1],
        tickUpper: this.positions[3][2],
        marginDelta: toBn("10"),
      };

      await this.periphery.connect(this.wallets[3]).swap(swapParameters);
    }
  }
}

describe("Rollover StableCoin", async () => {
  let initSetup: ScenarioRunnerStableCoin;
  let secondMarginEngine: IMarginEngine;
  let secondVAMM: IVAMM;
  let secondStart: BigNumber;
  let secondEnd: BigNumber;

  before("setup the old and new pool", async () => {
    initSetup = new ScenarioRunnerStableCoin(e2eParamsStableCoin);
    await initSetup.init();
    await initSetup.run();

    const now = await getCurrentTimestamp(provider);
    const start = now + consts.ONE_MONTH.toNumber();
    const end = start + consts.ONE_YEAR.toNumber();
    secondStart = toBn(start.toString());
    secondEnd = toBn(end.toString());
    [secondMarginEngine, secondVAMM] = await initSetup.deployIRSContracts(
      secondStart,
      secondEnd
    );
    [secondMarginEngine, secondVAMM] = await initSetup.configureIRS(
      secondMarginEngine,
      secondVAMM
    );

    await secondVAMM.setIsAlpha(true);
    await secondMarginEngine.setIsAlpha(true);
    await initSetup.periphery.setLPMarginCap(secondVAMM.address, toBn("4000"));
  });

  it("failed rolling - not yet mature", async () => {
    const ftAddress = initSetup.wallets[3].address;

    const swapParametersStageTwo = {
      marginEngine: secondMarginEngine.address,
      isFT: true,
      notional: toBn("100"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
      tickLower: initSetup.positions[3][1],
      tickUpper: initSetup.positions[3][2],
      marginDelta: toBn("14"),
    };

    await expect(
      initSetup.periphery
        .connect(initSetup.wallets[3])
        .rolloverWithSwap(
          initSetup.marginEngine.address,
          ftAddress,
          initSetup.positions[3][1],
          initSetup.positions[3][2],
          swapParametersStageTwo
        )
    ).to.be.revertedWith("CannotSettleBeforeMaturity()");

    await advanceTimeAndBlock(consts.ONE_MONTH.add(consts.ONE_HOUR), 1); // 1st pool reaches maturity
  });

  it("failed LP rolling - margin caps", async () => {
    const lpAddress = initSetup.wallets[0].address;

    const mintOrBurnParametersStageTwo = {
      marginEngine: secondMarginEngine.address,
      tickLower: initSetup.positions[0][1],
      tickUpper: initSetup.positions[0][2],
      notional: toBn("6000"),
      isMint: true,
      marginDelta: toBn("4001"),
    };

    await expect(
      initSetup.periphery.rolloverWithMint(
        initSetup.marginEngine.address,
        lpAddress,
        initSetup.positions[0][1],
        initSetup.positions[0][2],
        mintOrBurnParametersStageTwo
      )
    ).to.be.reverted;
  });

  it("LP rolling", async () => {
    const lpAddress = initSetup.wallets[0].address;

    const lpBalaceInit = await initSetup.token.balanceOf(lpAddress);
    const lpmarginCumulativeInit =
      await initSetup.periphery.lpMarginCumulatives(initSetup.vamm.address);

    const mintOrBurnParametersStageTwo = {
      marginEngine: secondMarginEngine.address,
      tickLower: initSetup.positions[0][1],
      tickUpper: initSetup.positions[0][2],
      notional: toBn("6000"),
      isMint: true,
      marginDelta: toBn("400"),
    };

    await initSetup.periphery.rolloverWithMint(
      initSetup.marginEngine.address,
      lpAddress,
      initSetup.positions[0][1],
      initSetup.positions[0][2],
      mintOrBurnParametersStageTwo
    );

    expect(await initSetup.token.balanceOf(lpAddress)).to.be.closeTo(
      lpBalaceInit.sub(toBn("190")),
      toBn("10")
    );

    expect(
      await initSetup.periphery.lpMarginCumulatives(initSetup.vamm.address)
    ).to.be.equal(lpmarginCumulativeInit.sub(toBn("210")));

    expect(
      await initSetup.periphery.lpMarginCumulatives(secondVAMM.address)
    ).to.be.equal(toBn("400"));

    expect(
      await initSetup.token.balanceOf(secondMarginEngine.address)
    ).to.be.equal(toBn("400"));
  });

  it("VT rolling", async () => {
    const vtAddress = initSetup.wallets[2].address;

    const vtBalaceInit = await initSetup.token.balanceOf(vtAddress);

    const swapParametersStageTwo = {
      marginEngine: secondMarginEngine.address,
      isFT: false,
      notional: toBn("2995"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: initSetup.positions[2][1],
      tickUpper: initSetup.positions[2][2],
      marginDelta: toBn("1000"),
    };

    await initSetup.periphery
      .connect(initSetup.wallets[2])
      .rolloverWithSwap(
        initSetup.marginEngine.address,
        vtAddress,
        initSetup.positions[2][1],
        initSetup.positions[2][2],
        swapParametersStageTwo
      );

    expect(await initSetup.token.balanceOf(vtAddress)).to.be.closeTo(
      vtBalaceInit,
      toBn("10")
    );

    expect(
      await initSetup.token.balanceOf(secondMarginEngine.address)
    ).to.be.equal(toBn("1400"));
  });

  it("FT rolling", async () => {
    const ftAddress = initSetup.wallets[3].address;

    const ftBalaceInit = await initSetup.token.balanceOf(ftAddress);

    const swapParametersStageTwo = {
      marginEngine: secondMarginEngine.address,
      isFT: true,
      notional: toBn("100"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
      tickLower: initSetup.positions[3][1],
      tickUpper: initSetup.positions[3][2],
      marginDelta: toBn("14"),
    };

    await initSetup.periphery
      .connect(initSetup.wallets[3])
      .rolloverWithSwap(
        initSetup.marginEngine.address,
        ftAddress,
        initSetup.positions[3][1],
        initSetup.positions[3][2],
        swapParametersStageTwo
      );

    expect(await initSetup.token.balanceOf(ftAddress)).to.be.closeTo(
      ftBalaceInit.sub(toBn("4")),
      toBn("10")
    );

    expect(
      await initSetup.token.balanceOf(secondMarginEngine.address)
    ).to.be.equal(toBn("1414"));
  });

  it("continue as usual after rollover", async () => {
    const mintOrBurnParametersStageTwo = {
      marginEngine: secondMarginEngine.address,
      tickLower: initSetup.positions[0][1],
      tickUpper: initSetup.positions[0][2],
      notional: toBn("6000"),
      isMint: true,
      marginDelta: toBn("400"),
    };

    await initSetup.periphery.mintOrBurn(mintOrBurnParametersStageTwo);

    const swapParametersVtStageTwo = {
      marginEngine: secondMarginEngine.address,
      isFT: false,
      notional: toBn("2995"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: initSetup.positions[2][1],
      tickUpper: initSetup.positions[2][2],
      marginDelta: toBn("1000"),
    };

    await initSetup.periphery
      .connect(initSetup.wallets[2])
      .swap(swapParametersVtStageTwo);

    const swapParametersFtStageTwo = {
      marginEngine: secondMarginEngine.address,
      isFT: true,
      notional: toBn("100"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
      tickLower: initSetup.positions[3][1],
      tickUpper: initSetup.positions[3][2],
      marginDelta: toBn("14"),
    };

    await initSetup.periphery
      .connect(initSetup.wallets[3])
      .swap(swapParametersFtStageTwo);
  });
});
