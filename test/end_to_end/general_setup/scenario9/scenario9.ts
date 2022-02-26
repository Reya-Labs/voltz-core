import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { random, randomInt } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    for (const p of this.positions.slice(5, 8)) {
      await this.e2eSetup.updatePositionMargin(p[0], p[1], p[2], toBn("10000"));
      console.log(
        "gas consumed for update position margin: ",
        (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
      );
    }

    const length_of_series = 12;
    const actions = [1, 2, 3];

    await this.rateOracleTest.increaseObservarionCardinalityNext(1000);
    await this.rateOracleTest.increaseObservarionCardinalityNext(2000);

    let accumulatedReserveNormalizedIncome = 1.0001;
    for (let step = 0; step < length_of_series * 4; step++) {
      // accumulatedReserveNormalizedIncome += random(0.0003, 0.0006);
      // await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, accumulatedReserveNormalizedIncome);
      await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);

      for (const p of this.positions) {
        await this.marginEngineTest.isLiquidatablePositionTest(
          p[0],
          p[1],
          p[2]
        );
        const isLiquidatable = await this.marginEngineTest.getIsLiquidatable();

        try {
          if (isLiquidatable) {
            await this.e2eSetup.liquidatePosition(
              this.positions[0][1],
              this.positions[0][2],
              this.positions[0][0],
              p[1],
              p[2],
              p[0]
            );
            console.log("is liquidatable");
          }
        } catch (_) {}
      }

      const action = step < 5 ? 1 : actions[randomInt(0, actions.length)];
      await this.exportSnapshot(
        "step: " + step.toString() + " / action: " + action.toString()
      );

      if (action === 1) {
        // position mint
        const p = this.positions[randomInt(0, 5)];
        const liquidityDelta = randomInt(10000, 100000);
        const liquidityDeltaBn = toBn(liquidityDelta.toString());
        const positionInfo = await this.marginEngineTest.getPosition(
          p[0],
          p[1],
          p[2]
        );

        await this.marginEngineTest.getCounterfactualMarginRequirementTest(
          p[0],
          p[1],
          p[2],
          liquidityDeltaBn,
          positionInfo.fixedTokenBalance,
          positionInfo.variableTokenBalance,
          positionInfo.margin,
          false
        );

        const positionMarginRequirement =
          await this.marginEngineTest.getMargin();

        console.log(
          "margin delta:",
          utils.formatEther(positionMarginRequirement.add(toBn("1")))
        );
        await this.e2eSetup.updatePositionMargin(
          p[0],
          p[1],
          p[2],
          positionMarginRequirement.add(toBn("1"))
        );
        console.log(
          "gas consumed for update position margin: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );

        await this.e2eSetup.mint(p[0], p[1], p[2], liquidityDeltaBn);
        console.log(
          "gas consumed for mint: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }

      if (action === 2) {
        // position burn
        const p = this.positions[randomInt(0, 5)];
        const current_liquidity =
          (await this.marginEngineTest.getPosition(p[0], p[1], p[2]))._liquidity
            .div(BigNumber.from(10).pow(12))
            .toNumber() /
          10 ** 6;
        const liquidityDelta = randomInt(0, Math.floor(current_liquidity));
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        if (liquidityDelta <= 0) continue;

        await this.e2eSetup.burn(p[0], p[1], p[2], liquidityDeltaBn);
        console.log(
          "gas consumed for burn: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }

      if (action === 3) {
        // trader swap
        const p = this.positions[randomInt(5, 8)];

        const min_vt = -Math.floor(await this.getVT("below"));
        const max_vt = Math.floor(await this.getVT("above"));
        const amount = randomInt(min_vt, max_vt);
        if (amount === 0) continue;
        console.log("vt:", min_vt, "->", amount, "->", max_vt);

        await this.e2eSetup.swap({
          recipient: p[0],
          amountSpecified: toBn(amount.toString()),
          sqrtPriceLimitX96:
            amount > 0
              ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
              : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),
          
          tickLower: p[1],
          tickUpper: p[2],
        });
        console.log(
          "gas consumed for swap: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }
    }

    const length_of_liquidation_series = 20;

    for (let step = 0; step < length_of_liquidation_series; step++) {
      accumulatedReserveNormalizedIncome += random(-0.0006, 0.0006);
      await this.advanceAndUpdateApy(
        consts.ONE_DAY,
        1,
        accumulatedReserveNormalizedIncome
      );

      for (const p of this.positions) {
        await this.marginEngineTest.isLiquidatablePositionTest(
          p[0],
          p[1],
          p[2]
        );
        const isLiquidatable = await this.marginEngineTest.getIsLiquidatable();

        try {
          if (isLiquidatable) {
            await this.e2eSetup.liquidatePosition(
              this.positions[0][1],
              this.positions[0][2],
              this.positions[0][0],
              p[1],
              p[2],
              p[0]
            );
            console.log("is liquidatable");
          }
        } catch (_) {}
      }
    }

    await advanceTimeAndBlock(this.params.duration, 4);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 9);
  const e2eParams = e2eScenarios[9];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario9/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[9].skipped) {
  it.skip("scenario 9", test);
} else {
  it("scenario 9", test);
}
