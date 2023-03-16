import { expect } from "chai";
import { waffle } from "hardhat";
import { BigNumber, ethers, utils, Wallet } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import {
  encodeSqrtRatioX96,
  MIN_SQRT_RATIO,
  TICK_SPACING,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { testConfig } from "../../../../poolConfigs/testConfig";

const { provider } = waffle;

const MAX_AMOUNT = BigNumber.from(10).pow(27);

const e2eParamsStableCoin: e2eParameters = {
  duration: consts.ONE_MONTH,
  numActors: 5,
  marginCalculatorParams: testConfig.marginCalculatorParams,
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
  isWETH: true,
  rateOracle: 4,
};

class ScenarioRunnerStableCoin extends ScenarioRunner {
  wallets!: Wallet[];

  override async run() {
    await this.factory.setPeriphery(this.periphery.address);

    this.wallets = [];
    for (let i = 0; i < this.params.numActors; i++) {
      const wallet = await provider.getWallets()[i];
      await this.token.mint(wallet.address, MAX_AMOUNT);
      await this.token
        .connect(wallet)
        .approve(this.periphery.address, MAX_AMOUNT);
      await this.token
        .connect(wallet)
        .approve(this.marginEngine.address, MAX_AMOUNT);
      this.wallets.push(wallet);
    }

    // LIQUIDITY
    await this.periphery.connect(this.wallets[0]).mintOrBurn({
      marginEngine: this.marginEngine.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("100000"),
      isMint: true,
      marginDelta: toBn("100000"),
    });

    await this.marginEngine
      .connect(this.wallets[1])
      .updatePositionMargin(
        this.wallets[1].address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("10")
      );
  }
}

describe("FC VT Swap Periphery: Stable Coin", async () => {
  let initSetup: ScenarioRunnerStableCoin;
  let variableFactorWad: BigNumber;
  let fcVTMarginReq: number;

  beforeEach("Setup before each test", async () => {
    initSetup = new ScenarioRunnerStableCoin(e2eParamsStableCoin);
    await initSetup.init();
    await initSetup.run();

    variableFactorWad = await initSetup.rateOracle.callStatic.variableFactor(
      await initSetup.marginEngine.termStartTimestampWad(),
      await initSetup.marginEngine.termEndTimestampWad()
    );

    let fixedTokenDeltaUnbalanced: number = 0;

    await initSetup.periphery
      .connect(initSetup.wallets[1])
      .callStatic.fullyCollateralisedVTSwap(
        {
          marginEngine: initSetup.marginEngine.address,
          isFT: false,
          notional: toBn("10"),
          sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          marginDelta: toBn("10"),
        },
        variableFactorWad
      )
      .then((result) => {
        fixedTokenDeltaUnbalanced = parseFloat(utils.formatEther(result[3]));
      });

    fcVTMarginReq =
      -fixedTokenDeltaUnbalanced *
      Number(
        ethers.utils.formatEther(
          (
            await initSetup.fixedAndVariableMath.fixedFactorTest(
              true,
              await initSetup.marginEngine.termStartTimestampWad(),
              await initSetup.marginEngine.termEndTimestampWad()
            )
          ).toString()
        )
      );
  });

  it("FC VT Swap: No slippage, over collateralised", async () => {
    // OVER-COLLATERALISED FC VT SWAP
    await initSetup.periphery
      .connect(initSetup.wallets[1])
      .callStatic.fullyCollateralisedVTSwap(
        {
          marginEngine: initSetup.marginEngine.address,
          isFT: false,
          notional: toBn("10"),
          sqrtPriceLimitX96: MIN_SQRT_RATIO.add(1),
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          marginDelta: toBn("0"),
        },
        variableFactorWad,
        { value: ethers.utils.parseUnits("10", "ether") }
      );
  });

  it("FC VT Swap: No slippage, just fully collateralised", async () => {
    // JUST FULLY-COLLATERALISED FC VT SWAP
    await initSetup.periphery
      .connect(initSetup.wallets[1])
      .callStatic.fullyCollateralisedVTSwap(
        {
          marginEngine: initSetup.marginEngine.address,
          isFT: false,
          notional: toBn("10"),
          sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          marginDelta: toBn("0"),
        },
        variableFactorWad,
        { value: ethers.utils.parseUnits(fcVTMarginReq.toString(), "ether") }
      );
  });

  it.skip("FC VT Swap: No slippage, just under fully collateralised", async () => {
    // JUST UNDER FULLY-COLLATERALISED FC VT SWAP
    await expect(
      initSetup.periphery
        .connect(initSetup.wallets[1])
        .callStatic.fullyCollateralisedVTSwap(
          {
            marginEngine: initSetup.marginEngine.address,
            isFT: false,
            notional: toBn("10"),
            sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
            tickLower: -TICK_SPACING,
            tickUpper: TICK_SPACING,
            marginDelta: toBn("0"),
          },
          variableFactorWad,
          {
            value: ethers.utils.parseUnits(
              (fcVTMarginReq - 0.00001).toString(),
              "ether"
            ),
          }
        )
    ).to.be.revertedWith("VT swap not fc");
  });

  it.skip("FC VT Swap: Reverted swap after slippage", async () => {
    // CREATE SOME SLIPPAGE
    await initSetup.periphery.connect(initSetup.wallets[1]).swap({
      marginEngine: initSetup.marginEngine.address,
      isFT: false,
      notional: toBn("10000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: toBn(fcVTMarginReq.toString()),
    });

    // SHOULD REVERT
    await expect(
      initSetup.periphery
        .connect(initSetup.wallets[1])
        .callStatic.fullyCollateralisedVTSwap(
          {
            marginEngine: initSetup.marginEngine.address,
            isFT: false,
            notional: toBn("10"),
            sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
            tickLower: -TICK_SPACING,
            tickUpper: TICK_SPACING,
            marginDelta: toBn("0"),
          },
          variableFactorWad,
          { value: ethers.utils.parseUnits(fcVTMarginReq.toString(), "ether") }
        )
    ).to.be.revertedWith("VT swap not fc");
  });

  it("FC VT Swap: No slippage, just fully collateralised, advanced time", async () => {
    // JUST FULLY-COLLATERALISED FC VT SWAP
    await initSetup.periphery
      .connect(initSetup.wallets[1])
      .callStatic.fullyCollateralisedVTSwap(
        {
          marginEngine: initSetup.marginEngine.address,
          isFT: false,
          notional: toBn("10"),
          sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          marginDelta: toBn("0"),
        },
        variableFactorWad,
        { value: ethers.utils.parseUnits(fcVTMarginReq.toString(), "ether") }
      );
  });

  it.skip("FC VT Swap: No slippage, just under fully collateralised, advanced time", async () => {
    // JUST UNDER FULLY-COLLATERALISED FC VT SWAP
    await expect(
      initSetup.periphery
        .connect(initSetup.wallets[1])
        .callStatic.fullyCollateralisedVTSwap(
          {
            marginEngine: initSetup.marginEngine.address,
            isFT: false,
            notional: toBn("10"),
            sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
            tickLower: -TICK_SPACING,
            tickUpper: TICK_SPACING,
            marginDelta: toBn("0"),
          },
          variableFactorWad,
          {
            value: ethers.utils.parseUnits(
              (fcVTMarginReq - 0.00001).toString(),
              "ether"
            ),
          }
        )
    ).to.be.revertedWith("VT swap not fc");
  });
});
