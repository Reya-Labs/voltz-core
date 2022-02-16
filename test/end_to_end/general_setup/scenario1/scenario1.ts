import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    for (const p of this.positions) {
      await this.getAPYboundsAndPositionMargin(p);

      await this.e2eSetup.updatePositionMargin(p[0], p[1], p[2], toBn("25"));
    }

    await this.rateOracleTest.increaseObservarionCardinalityNext(1000);
    await this.rateOracleTest.increaseObservarionCardinalityNext(2000);

    // each LP deposits 1,010 liquidity 100 times

    for (let i = 0; i < 100; i++) {
      console.log("mint phase: ", i);
      for (const p of this.positions) {
        await this.e2eSetup.mint(p[0], p[1], p[2], toBn("1001"));
      }
    }

    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(25), 1, 1.0012);

    await this.exportSnapshot("AFTER 100 MINTS");

    for (const p of this.positions) {
      await this.e2eSetup.updatePositionMargin(p[0], p[1], p[2], toBn("100"));
    }

    const sqrtPriceLimit = await this.testTickMath.getSqrtRatioAtTick(
      -TICK_SPACING
    );
    for (let i = 0; i < 100; i++) {
      console.log("swap phase: ", i);
      for (const p of this.positions) {
        await this.e2eSetup.swap({
          recipient: p[0],
          amountSpecified: toBn("-3"),
          sqrtPriceLimitX96: sqrtPriceLimit,
          isExternal: false,
          tickLower: p[1],
          tickUpper: p[2],
        });
      }
    }

    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(25), 1, 1.0015);

    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 1);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

it("scenario 1", async () => {
  console.log("scenario", 1);
  const e2eParams = e2eScenarios[1];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario1/console.txt"
  );
  await scenario.init();
  await scenario.run();
});
