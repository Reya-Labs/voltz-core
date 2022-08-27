import { expect } from "chai";
import { waffle } from "hardhat";
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

    devMulLeftUnwindLMWad: toBn("0.5"),
    devMulRightUnwindLMWad: toBn("0.5"),
    devMulLeftUnwindIMWad: toBn("0.8"),
    devMulRightUnwindIMWad: toBn("0.8"),

    fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
    fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

    fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
    fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

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

// -------------------------- Alpha pool tests --------------------------
it("Check approvals work for periphery", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(true);
      await this.marginEngine.setIsAlpha(true);
      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 24));
      // await this.token.approve(this.periphery.address, toBn("1", 27));

      const wallet = provider.getWallets()[0];
      const other = provider.getWallets()[1];

      let isApproved = await this.factory.isApproved(
        wallet.address,
        other.address
      );
      expect(isApproved).to.eq(false);

      await this.factory.connect(wallet).setApproval(other.address, true);
      isApproved = await this.factory.isApproved(wallet.address, other.address);
      expect(isApproved).to.eq(true);

      await this.factory.connect(wallet).setApproval(other.address, false);
      isApproved = await this.factory.isApproved(wallet.address, other.address);
      expect(isApproved).to.eq(false);
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint tokens in alpha pools and WITHDRAW margin", async () => {
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
          notional: toBn("30000"),
          isMint: true,
          marginDelta: toBn("2500"),
        };

        // add 1,000,000 liquidity to Position 0
        await this.periphery.mintOrBurn(mintOrBurnParameters);
      }

      // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 1000 margin
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("-1000"),
        false
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone from 2500 as initialised to 1500 after withdrawal of 1000
      expect(position.margin).to.eq(toBn("1500"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint tokens in alpha pools and DEPOSIT margin then burn liquidity", async () => {
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
        const mintOrBurnParameters1 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("30000"),
          isMint: true,
          marginDelta: toBn("2500"),
        };

        // add 1,000,000 liquidity to Position 0
        await this.periphery.mintOrBurn(mintOrBurnParameters1);

        const mintOrBurnParameters2 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("1000"),
          isMint: false,
          marginDelta: toBn("1000"),
        };
        // Burn liquidity
        await this.periphery.mintOrBurn(mintOrBurnParameters2);
      }

      // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 1000 margin
      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("1000"),
        false
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("4500"));

      const notionalAmount = await this.sqrtPriceMath.getAmount1Delta(
        await this.tickMath.getSqrtRatioAtTick(LOWER_TICK),
        await this.tickMath.getSqrtRatioAtTick(UPPER_TICK),
        position._liquidity,
        true
      );
      console.log("printing the notionalAmount: ", notionalAmount); // sanity check
      expect(notionalAmount).to.eq(toBn("29000"));
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
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("30000"),
          isMint: true,
          marginDelta: toBn("1000"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("900"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        // add 1,000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 1000 margin
        await this.periphery.updatePositionMargin(
          this.marginEngine.address,
          LOWER_TICK,
          UPPER_TICK,
          toBn("1000"),
          false
        );
        // Perform a FT swap on ERC20 pool to create a position
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
          notional: toBn("3000"),
          isMint: true,
          marginDelta: toBn("1000"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("1500"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot mint more than the margin cap", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);

      await this.vamm.setIsAlpha(true);

      await this.marginEngine.setIsAlpha(true);

      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 20));

      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("99"),
          isMint: true,
          marginDelta: toBn("99"),
        };

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintParameters);
      }

      const mintMoreParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: LOWER_TICK,
        tickUpper: UPPER_TICK,
        notional: toBn("2"),
        isMint: true,
        marginDelta: toBn("2"),
      };
      await expect(
        this.periphery.mintOrBurn(mintMoreParameters)
      ).to.be.revertedWith("lp cap limit");
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot mint more than the notional cap", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);

      await this.vamm.setIsAlpha(true);

      await this.marginEngine.setIsAlpha(true);

      await this.periphery.setLPMarginCap(this.vamm.address, toBn("1", 19));

      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintParameters1 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("9"),
          isMint: true,
          marginDelta: toBn("10"),
        };

        const mintParameters2 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("9"),
          isMint: false,
          marginDelta: toBn("0"),
        };

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintParameters1);
        await this.periphery.mintOrBurn(mintParameters2);
      }

      const mintMoreParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: LOWER_TICK,
        tickUpper: UPPER_TICK,
        notional: toBn("2"),
        isMint: true,
        marginDelta: toBn("10"),
      };
      await expect(this.periphery.mintOrBurn(mintMoreParameters)).to.be
        .reverted;
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
it("Mint tokens in non-alpha pools and WITHDRAW margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      // Approves 1 billion tokens to be transferred on the behalf of the sender
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("30000"),
          isMint: true,
          marginDelta: toBn("2500"),
        };

        await this.periphery.mintOrBurn(mintOrBurnParameters);
      }

      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("-1000"),
        false
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      // We expect the position margin to have gone from 2500 as initialised to 1500 after withdrawal of 1000
      expect(position.margin).to.eq(toBn("1500"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Mint tokens in  non-alpha pools and DEPOSIT margin then burn liquidity", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;
      {
        const mintOrBurnParameters1 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("30000"),
          isMint: true,
          marginDelta: toBn("2500"),
        };

        await this.periphery.mintOrBurn(mintOrBurnParameters1);

        const mintOrBurnParameters2 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("1000"),
          isMint: false,
          marginDelta: toBn("1000"),
        };

        await this.periphery.mintOrBurn(mintOrBurnParameters2);
      }

      await this.periphery.updatePositionMargin(
        this.marginEngine.address,
        LOWER_TICK,
        UPPER_TICK,
        toBn("1000"),
        false
      );

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("4500"));

      const notionalAmount = await this.sqrtPriceMath.getAmount1Delta(
        await this.tickMath.getSqrtRatioAtTick(LOWER_TICK),
        await this.tickMath.getSqrtRatioAtTick(UPPER_TICK),
        position._liquidity,
        true
      );
      console.log("printing the notionalAmount: ", notionalAmount); // sanity check
      expect(notionalAmount).to.eq(toBn("29000"));
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
          notional: toBn("30000"),
          isMint: true,
          marginDelta: toBn("1000"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("900"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(),
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        // add 1,000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Now that we have deposited margin and minted tokens we want to update the margin by withdrawing 1000 margin
        await this.periphery.updatePositionMargin(
          this.marginEngine.address,
          LOWER_TICK,
          UPPER_TICK,
          toBn("1000"),
          false
        );
        // Perform a FT swap on ERC20 pool to create a position
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
          notional: toBn("3000"),
          isMint: true,
          marginDelta: toBn("1000"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("1500"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot mint more than the margin cap", async () => {
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
          notional: toBn("99"),
          isMint: true,
          marginDelta: toBn("99"),
        };

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintParameters);
      }

      const mintMoreParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: LOWER_TICK,
        tickUpper: UPPER_TICK,
        notional: toBn("2"),
        isMint: true,
        marginDelta: toBn("2"),
      };
      await expect(this.periphery.mintOrBurn(mintMoreParameters)).to.not.be
        .reverted;
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot mint more than the notional cap", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK = -7200;
      const UPPER_TICK = 0;

      {
        const mintParameters1 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("9"),
          isMint: true,
          marginDelta: toBn("10"),
        };

        const mintParameters2 = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          notional: toBn("9"),
          isMint: false,
          marginDelta: toBn("0"),
        };

        await this.periphery.mintOrBurn(mintParameters1);
        await this.periphery.mintOrBurn(mintParameters2);
      }

      const mintMoreParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: LOWER_TICK,
        tickUpper: UPPER_TICK,
        notional: toBn("2"),
        isMint: true,
        marginDelta: toBn("10"),
      };
      await expect(this.periphery.mintOrBurn(mintMoreParameters)).to.not.be
        .reverted;
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

// -------------------------- Remove notional during swap --------------------------

it("Check you cannot take a VT position with negative margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("3000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down
        console.log(
          "margin delta swap:",
          swapParameters.marginDelta.toString()
        );

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await expect(this.periphery.swap(swapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("0"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot take a FT position with negative margin", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("3000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down
        console.log(
          "margin delta swap:",
          swapParameters.marginDelta.toString()
        );

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await expect(this.periphery.swap(swapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("0"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot add notional to a FT position without respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("499").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await expect(this.periphery.swap(updateSwapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("500"));
      expect(position.variableTokenBalance).to.eq(toBn("1000").mul(-1));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot add notional a VT position without respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("499").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await expect(this.periphery.swap(updateSwapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("500"));
      expect(position.variableTokenBalance).to.eq(toBn("1000"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you can add notional a FT position while respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("464").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await this.periphery.swap(updateSwapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("36"));
      expect(position.variableTokenBalance).to.eq(toBn("2000").mul(-1));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you can add notional a VT position while respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("464").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await this.periphery.swap(updateSwapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("36"));
      expect(position.variableTokenBalance).to.eq(toBn("2000"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot remove notional from VT (switch FT) position without respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("2000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("499").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await expect(this.periphery.swap(updateSwapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("500"));
      expect(position.variableTokenBalance).to.eq(toBn("1000"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot remove notional FT (switch VT) position without respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("2000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("499").mul(-1),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await expect(this.periphery.swap(updateSwapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("500"));
      expect(position.variableTokenBalance).to.eq(toBn("1000").mul(-1));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you can remove notional from FT (switch VT) position while respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("2000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("464").mul(-1),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await this.periphery.swap(updateSwapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("36"));
      expect(position.variableTokenBalance).to.eq(toBn("1000"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you can remove notional from VT (switch FT) position while respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("2000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("464").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await this.periphery.swap(updateSwapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("36"));
      expect(position.variableTokenBalance).to.eq(toBn("1000").mul(-1));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot remove notional from VT position without respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("500"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("499").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await expect(this.periphery.swap(updateSwapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("500"));
      expect(position.variableTokenBalance).to.eq(toBn("1000"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you cannot remove notional FT position without respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("500"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("499").mul(-1),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await expect(this.periphery.swap(updateSwapParameters)).to.be.reverted;
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("500"));
      expect(position.variableTokenBalance).to.eq(toBn("1000").mul(-1));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you can remove notional from FT position while respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("500"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("482").mul(-1),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("1000"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await this.periphery.swap(updateSwapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("18"));
      expect(position.variableTokenBalance).to.eq(toBn("500").mul(-1));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});

it("Check you can remove notional from VT position while respecting margin rquirements", async () => {
  class ScenarioRunnerInstance extends ScenarioRunner {
    override async run() {
      await this.factory.setPeriphery(this.periphery.address);
      await this.vamm.setIsAlpha(false);
      await this.marginEngine.setIsAlpha(false);
      await this.token.approve(this.periphery.address, toBn("1", 27));

      const LOWER_TICK_MINT = -7200;
      const UPPER_TICK_MINT = 0;
      const LOWER_TICK = -69060;
      const UPPER_TICK = 0;
      const TICK_SPACING = UPPER_TICK - LOWER_TICK;

      {
        const mintOrBurnParameters = {
          marginEngine: this.marginEngine.address,
          tickLower: LOWER_TICK_MINT,
          tickUpper: UPPER_TICK_MINT,
          notional: toBn("10000"),
          isMint: true,
          marginDelta: toBn("100"),
        };

        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: false,
          notional: toBn("1000"),
          sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(LOWER_TICK).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("500"),
        };

        const updateSwapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: true,
          notional: toBn("500"),
          sqrtPriceLimitX96:
            TickMath.getSqrtRatioAtTick(TICK_SPACING).toString(), // lowest price or highest fixed rate prepared to pay as a VT
          tickLower: LOWER_TICK,
          tickUpper: UPPER_TICK,
          marginDelta: toBn("482").mul(-1),
        };
        // enter valueToBigNumber, push fixed rate up --> push price down because ifxed rate=1/price --> push tick down

        // add 3000 liquidity to Position
        await this.periphery.mintOrBurn(mintOrBurnParameters);

        // Perform a FT swap on ERC20 pool to create a position
        await this.periphery.swap(swapParameters);

        await this.periphery.swap(updateSwapParameters);
      }

      const position = await this.marginEngine.callStatic.getPosition(
        this.owner.address,
        LOWER_TICK,
        UPPER_TICK
      );

      expect(position.margin).to.eq(toBn("18"));
      expect(position.variableTokenBalance).to.eq(toBn("500"));
    }
  }

  const test = async () => {
    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  await test();
});
