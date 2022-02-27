import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    await this.getAPYboundsAndPositionMargin(this.positions[0]);

    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("125")
    );

    await this.rateOracleTest.increaseObservarionCardinalityNext(1000);
    await this.rateOracleTest.increaseObservarionCardinalityNext(2000);

    // each LP deposits 1,010 liquidity 100 times

    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("500500")
    );

    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(25), 1, 1.0012);

    await this.exportSnapshot("AFTER MINT");

    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("500")
    );

    const sqrtPriceLimit = await this.testTickMath.getSqrtRatioAtTick(
      -TICK_SPACING
    );
    await this.e2eSetup.swap({
      recipient: this.positions[0][0],
      amountSpecified: toBn("-1500"),
      sqrtPriceLimitX96: sqrtPriceLimit,

      tickLower: this.positions[0][1],
      tickUpper: this.positions[0][2],
    });

    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(25), 1, 1.0015);

    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 1);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

it.skip("scenario 1 at Once", async () => {
  console.log("scenario", 1, "at Once");
  const e2eParams = e2eScenarios[1];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario1-atOnce/console.txt"
  );
  await scenario.init();
  await scenario.run();
});
