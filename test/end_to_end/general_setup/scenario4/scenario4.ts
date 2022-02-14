import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { randomInt } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    for (const t of this.traders) {
      await this.e2eSetup.updateTraderMargin(t, toBn("10000"));
    }

    const length_of_series = 50;
    const actions = [1, 2, 3];

    await this.rateOracleTest.increaseObservarionCardinalityNext(1000);
    await this.rateOracleTest.increaseObservarionCardinalityNext(2000);

    for (let step = 0; step < length_of_series * 4; step++) {
      // await advanceAndUpdateApy(consts.ONE_HOUR, 1, 1.010 + step * 0.00001);
      // await this.advanceAndUpdateApy(consts.ONE_HOUR, 1, 1.01);
      await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);

      const action = step < 5 ? 1 : actions[randomInt(0, actions.length)];
      await this.exportSnapshot(
        "step: " + step.toString() + " / action: " + action.toString()
      );

      if (action === 1) {
        // position mint
        const p = this.positions[randomInt(0, this.positions.length)];
        const liquidityDelta = randomInt(10000, 100000);
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        const positionTraderRequirement =
          await this.getAPYboundsAndPositionMargin(p, liquidityDeltaBn);

        await this.e2eSetup.updatePositionMargin(
          {
            owner: p[0],
            tickLower: p[1],
            tickUpper: p[2],
            liquidityDelta: 0,
          },
          positionTraderRequirement.add(toBn("1"))
        );

        await this.e2eSetup.mint(p[0], p[1], p[2], liquidityDeltaBn);
      }

      if (action === 2) {
        // position burn
        const p = this.positions[randomInt(0, this.positions.length)];
        const current_liquidity =
          (await this.marginEngineTest.getPosition(p[0], p[1], p[2]))._liquidity
            .div(BigNumber.from(10).pow(12))
            .toNumber() /
          10 ** 6;
        const liquidityDelta = randomInt(0, Math.floor(current_liquidity));
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        if (liquidityDelta <= 0) continue;

        await this.e2eSetup.burn(p[0], p[1], p[2], liquidityDeltaBn);
      }

      if (action === 3) {
        // trader swap
        const t = this.traders[randomInt(0, this.traders.length)];

        const min_vt = -Math.floor(await this.getVT("below"));
        const max_vt = Math.floor(await this.getVT("above"));
        const amount = randomInt(min_vt, max_vt);
        console.log("vt:", min_vt, "->", amount, "->", max_vt);

        await this.e2eSetup.swap({
          recipient: t,
          isFT: amount > 0,
          amountSpecified: toBn(amount.toString()),
          sqrtPriceLimitX96:
            amount > 0
              ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
              : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),
          isUnwind: false,
          isTrader: true,
          tickLower: 0,
          tickUpper: 0,
        });
      }
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90 - length_of_series), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositionsAndTraders(this.positions, this.traders);

    await this.exportSnapshot("FINAL");
  }
}

it.skip("scenario 4", async () => {
  console.log("scenario", 4);
  const e2eParams = e2eScenarios[4];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario4/console.txt"
  );
  await scenario.init();
  await scenario.run();
});
