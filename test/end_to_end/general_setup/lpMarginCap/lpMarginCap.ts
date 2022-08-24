import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodeSqrtRatioX96,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  MIN_SQRT_RATIO,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { Periphery } from "../../../../typechain";

const { provider } = waffle;

const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(3),
  numActors: 4,
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
    gap1: toBn("0"),
    gap2: toBn("0"),
    gap3: toBn("0"),
    gap4: toBn("0"),
    gap5: toBn("0"),
    gap6: toBn("0"),

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
  ],
  isWETH: false,
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.factory.setPeriphery(this.periphery.address);

    if (!this.fcm) {
      throw new Error("This end-to-end test involves fcm");
    }

    const otherWallet = provider.getWallets()[1];

    // expect alpha setting to revert when non-owner wallets call them
    await expect(this.vamm.connect(otherWallet).setIsAlpha(true)).to.be
      .reverted;

    await expect(this.marginEngine.connect(otherWallet).setIsAlpha(true)).to.be
      .reverted;

    // expect cap setting to revert when non-owner wallets call them
    await expect(
      this.periphery
        .connect(otherWallet)
        .setLPMarginCap(this.vamm.address, toBn("1000"))
    ).to.be.reverted;

    // set alpha state to true and margin cap to 1,000
    await this.vamm.setIsAlpha(true);
    await this.marginEngine.setIsAlpha(true);
    await this.periphery.setLPMarginCap(this.vamm.address, toBn("1000"));

    // deposit 210 margin as LP
    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: toBn("6000"),
        isMint: true,
        marginDelta: toBn("210"),
      };

      // add 1,000,000 liquidity to Position 0
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[0][0],
        mintOrBurnParameters
      );
    }

    // check that LP margin is accounted
    expect(
      await this.periphery.lpMarginCumulatives(this.vamm.address)
    ).to.be.equal(toBn("210"));

    // deposit 1,000 as Trader
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
      await this.e2eSetup.swapViaPeriphery(
        this.positions[2][0],
        swapParameters
      );
    }

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        notional: toBn("30000"),
        isMint: true,
        marginDelta: toBn("2500"),
      };

      // trying to deposit 2,500 margin as LP, expect to fail
      await expect(
        this.e2eSetup.mintOrBurnViaPeriphery(
          this.positions[1][0],
          mintOrBurnParameters
        )
      ).to.be.revertedWith("lp cap limit");

      // increase LP margin cap to 3,000
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("3000"));

      // deposit 2,500 margin as LP
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[1][0],
        mintOrBurnParameters
      );

      // expect only 210 and 2,500 (as LP) to be accounted
      expect(
        await this.periphery.lpMarginCumulatives(this.vamm.address)
      ).to.be.equal(toBn("2710"));
    }

    // same results if this flag is true or false
    const deployNewPeriphery = false;
    if (deployNewPeriphery) {
      /// deploy new periphery
      const peripheryFactory = await ethers.getContractFactory("Periphery");
      const newPeriphery = (await peripheryFactory.deploy()) as Periphery;

      await this.periphery.upgradeTo(newPeriphery.address);

      await this.factory.setPeriphery(this.periphery.address);
      await this.e2eSetup.setPeripheryAddress(this.periphery.address);

      const MAX_AMOUNT = BigNumber.from(10).pow(27);

      for (let i = 0; i < this.params.numActors; i++) {
        // eslint-disable-next-line no-empty
        if (this.params.noMintTokens) {
        } else {
          await this.mintAndApprove(this.actors[i].address, MAX_AMOUNT);
        }

        /// set manually the approval of contracts to act on behalf of actors
        for (const ad of [
          this.fcm.address,
          this.periphery.address,
          this.vamm.address,
          this.marginEngine.address,
        ]) {
          await this.token.approveInternal(
            this.actors[i].address,
            ad,
            MAX_AMOUNT
          );
          await this.aToken.approveInternal(
            this.actors[i].address,
            ad,
            MAX_AMOUNT
          );
          if (ad !== this.fcm.address) {
            await this.e2eSetup.setIntegrationApproval(
              this.actors[i].address,
              ad,
              true
            );
          }
        }
      }

      await this.periphery.setLPMarginCap(this.vamm.address, toBn("3000"));
      await this.periphery.setLPMarginCumulative(
        this.vamm.address,
        toBn("2710")
      );
    }

    // deposit 90 margin as LP
    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: toBn("6000"),
        isMint: true,
        marginDelta: toBn("90"),
      };

      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[0][0],
        mintOrBurnParameters
      );
    }

    // 2,800

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        notional: toBn("30000"),
        isMint: true,
        marginDelta: toBn("2500"),
      };

      // trying to deposit 2,500 margin as LP, expect to fail
      await expect(
        this.e2eSetup.mintOrBurnViaPeriphery(
          this.positions[1][0],
          mintOrBurnParameters
        )
      ).to.be.revertedWith("lp cap limit");

      // transit pool to non-alpha state
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);

      // deposit 2,500 margin as LP
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[1][0],
        mintOrBurnParameters
      );

      // expect for the margin to not be accounted anymore
      expect(
        await this.periphery.lpMarginCumulatives(this.vamm.address)
      ).to.be.equal(toBn("2800"));
    }

    // reach maturity
    await advanceTimeAndBlock(this.params.duration, 1);

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("LP Margin Cap", test);
