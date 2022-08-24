import { expect } from "chai";
import { ethers } from "hardhat";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodeSqrtRatioX96,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { TickMath } from "../../../shared/tickMath";
import { advanceTimeAndBlock } from "../../../helpers/time";

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
  isWETH: true,
  rateOracle: 4,
};

// -------------------------- Alpha pool tests --------------------------
it("Mint tokens in an alpha eth pool and deposit 10 eth margin, then update margin with +1 eth", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      // This could be written into the general.ts file.
      // It sets the periphery contract address within the factory contract
      await this.factory.setPeriphery(this.periphery.address);
      // Sets the alpha state of the pool
      await this.vamm.setIsAlpha(true);
      // Sets the margin engine to alpha
      await this.marginEngine.setIsAlpha(true);
      // Sets the LP margin cap to 1 Million ie 1 with 24 zeros in WAD format
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      // Approves 1 billion tokens to be transferred on the behalf of the sender
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;
      // First we have to mint some tokens by calling the mintOrBurnParameters compound function
      // This function first deposits margin (the marginDelta amount) and then it mints tokens
      // The deposited margin has to cover the min margin requirement for the mint.
      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);
      }

      // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 10 margin
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        0,
        false,
        { value: ethers.utils.parseUnits("1", "ether") } // parsing ether converts to 10^18 wei
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone from 210 to 211 after updating the margin
      expect(position.margin).to.eq(toBn("11"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };
  await test();
});

it("Mint tokens in an alpha eth pool and deposit 10 eth margin, then update margin with -1 eth", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(true);
      await this.marginEngine.setIsAlpha(true);
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);
      }

      // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 10 margin
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("-1"),
        false
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone from 210 to 209 after updating the margin
      expect(position.margin).to.eq(toBn("9"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };
  await test();
});

it("Mint in alpha pool, perform an FT swap and then settle the position and withdraw the margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(true);
      await this.marginEngine.setIsAlpha(true);
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;
      const TICK_SPACING = 60;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("900"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("0"),
          value: ethers.utils.parseUnits("1", "ether"), // parsing ether converts to 10^18 wei
        };

        // add 1,000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);

        // Perform a FT swap on eth pool to create a position
        await this.periphery.swap(swapParameters);

        // Some time needs to pass to reach maturity for the position,
        await advanceTimeAndBlock(consts.ONE_MONTH.mul(12), 12);

        await this.periphery.settlePositionAndWithdrawMargin(
          this.marginEngine.address,
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone to 0 after settlement and withdrawal
      expect(position.margin).to.eq(toBn("0"));
      // Expect the position to be settled after settling and withdrawing the margin in the position.
      expect(position.isSettled).to.eq(true);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint in alpha pool, perform a VT swap and then settle the position and withdraw the margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(true);
      await this.marginEngine.setIsAlpha(true);
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("900"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("0"),
          value: ethers.utils.parseUnits("1", "ether"), // parsing ether converts to 10^18 wei
        };

        // add 1,000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);

        // Perform a FT swap on eth pool to create a position
        await this.periphery.swap(swapParameters);

        // Some time needs to pass to reach maturity for the position,
        await advanceTimeAndBlock(consts.ONE_MONTH.mul(12), 12);

        await this.periphery.settlePositionAndWithdrawMargin(
          this.marginEngine.address,
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone to 0 after settlement and withdrawal
      expect(position.margin).to.eq(toBn("0"));
      // Expect the position to be settled after settling and withdrawing the margin in the position.
      expect(position.isSettled).to.eq(true);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint in alpha eth pool, and withdraw margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(true);
      await this.marginEngine.setIsAlpha(true);
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };
        // Mint 30,000 liquidity to Position
        await this.periphery.mintOrBurn(mintParameters, tempOverrides);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      const notionalAmount = await this.sqrtPriceMath.getAmount1Delta(
        await this.tickMath.getSqrtRatioAtTick(LOWER_TICK),
        await this.tickMath.getSqrtRatioAtTick(UPPER_TICK),
        position._liquidity,
        true
      );

      expect(notionalAmount).to.eq(toBn("300"));
      expect(position.margin).to.eq(toBn("10"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint in alpha eth pool, perform FT swap, settle and withdraw entire margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(true);
      await this.marginEngine.setIsAlpha(true);
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("400"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("100"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: 0,
          value: ethers.utils.parseEther("10"),
        };

        const tempOverrides = { value: ethers.utils.parseEther("20") };

        // add 30k liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);

        const positionBefore = await this.marginEngine.callStatic.getPosition(
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
        // Perform a FT swap on eth pool to create a position
        await this.periphery.swap(swapParameters);
        // Sanity check the position
        console.log(
          "Is the position settled after the FT swap?: ",
          positionBefore.isSettled
        );

        // Some time needs to pass to reach maturity for the position,
        await advanceTimeAndBlock(consts.ONE_MONTH.mul(12), 12);

        // settle and withdraw
        await this.periphery.settlePositionAndWithdrawMargin(
          this.marginEngine.address,
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
      }
      const positionAfter = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(positionAfter.margin).to.eq(toBn("0"));
      expect(positionAfter.isSettled).to.eq(true);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

// -------------------------- Non-alpha pool tests --------------------------
it("Mint tokens in non-alpha eth pool and deposit 210 eth margin, then update margin with +1 eth", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);
      }

      // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 10 margin
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        0,
        false,
        { value: ethers.utils.parseUnits("1", "ether") } // parsing ether converts to 10^18 wei
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone from 210 to 211 after updating the margin
      expect(position.margin).to.eq(toBn("11"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };
  await test();
});

it("Mint tokens in non-alpha eth pool and deposit 210 eth margin, then update margin with -1 eth", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);
      }

      // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 1 margin
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("-1"),
        false
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone from 210 to 209 after updating the margin
      expect(position.margin).to.eq(toBn("9"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };
  await test();
});

it("Mint in non-alpha pool, perform an FT swap and then settle the position and withdraw the margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;
      const TICK_SPACING = 60;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("900"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("0"),
          value: ethers.utils.parseUnits("1", "ether"), // parsing ether converts to 10^18 wei
        };

        // add 1,000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);

        // Perform a FT swap on eth pool to create a position
        await this.periphery.swap(swapParameters);

        // Some time needs to pass to reach maturity for the position,
        await advanceTimeAndBlock(consts.ONE_MONTH.mul(12), 12);

        await this.periphery.settlePositionAndWithdrawMargin(
          this.marginEngine.address,
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone to 0 after settlement and withdrawal
      expect(position.margin).to.eq(toBn("0"));
      // Expect the position to be settled after settling and withdrawing the margin in the position.
      expect(position.isSettled).to.eq(true);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint in non-alpha pool, perform a VT swap and then settle the position and withdraw the margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("300"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const tempOverrides = {
          value: ethers.utils.parseEther("10"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("900"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("0"),
          value: ethers.utils.parseUnits("1", "ether"), // parsing ether converts to 10^18 wei
        };

        // add 1,000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);

        // Perform a FT swap on eth pool to create a position
        await this.periphery.swap(swapParameters);

        // Some time needs to pass to reach maturity for the position,
        await advanceTimeAndBlock(consts.ONE_MONTH.mul(12), 12);

        await this.periphery.settlePositionAndWithdrawMargin(
          this.marginEngine.address,
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone to 0 after settlement and withdrawal
      expect(position.margin).to.eq(toBn("0"));
      // Expect the position to be settled after settling and withdrawing the margin in the position.
      expect(position.isSettled).to.eq(true);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint and burn in non-alpha eth pool, and withdraw some margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("3000"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const burnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("1400"),
          isMint: false,
          marginDelta: toBn("0"),
        };

        const mintTempOverride = {
          value: ethers.utils.parseEther("20"),
        };

        const burnTempOverride = {
          value: ethers.utils.parseEther("1"),
        };

        // Mint 30,000 liquidity to Position
        await this.periphery.mintOrBurn(mintParameters, mintTempOverride);

        // Burn 14,000 liquidity from Position
        await this.periphery.mintOrBurn(burnParameters, burnTempOverride);
      }
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("-10"),
        false
      );
      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      const notionalAmount = await this.sqrtPriceMath.getAmount1Delta(
        await this.tickMath.getSqrtRatioAtTick(LOWER_TICK),
        await this.tickMath.getSqrtRatioAtTick(UPPER_TICK),
        position._liquidity,
        true
      );

      expect(notionalAmount).to.eq(toBn("1600"));
      expect(position.margin).to.eq(toBn("11"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint in non-alpha eth pool, perform FT swap, settle and withdraw entire margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("400"),
          isMint: true,
          marginDelta: toBn("0"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("100"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: 0,
          value: ethers.utils.parseEther("10"),
        };

        const tempOverrides = { value: ethers.utils.parseEther("20") };

        // add 30k liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters, tempOverrides);

        const positionBefore = await this.marginEngine.callStatic.getPosition(
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
        // Perform a FT swap on eth pool to create a position
        await this.periphery.swap(swapParameters);
        // Sanity check the position
        console.log(
          "Is the position settled after the FT swap?: ",
          positionBefore.isSettled
        );

        // Some time needs to pass to reach maturity for the position,
        await advanceTimeAndBlock(consts.ONE_MONTH.mul(12), 12);

        // settle and withdraw
        await this.periphery.settlePositionAndWithdrawMargin(
          this.marginEngine.address,
          this.owner.address,
          LOWER_TICK,
          UPPER_TICK
        );
      }
      const positionAfter = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(positionAfter.margin).to.eq(toBn("0"));
      expect(positionAfter.isSettled).to.eq(true);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});
