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
      console.log(
        "gas consumed for update position margin: ",
        (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
      );
    }

    await this.rateOracleTest.increaseObservarionCardinalityNext(1000);
    await this.rateOracleTest.increaseObservarionCardinalityNext(2000);

    // each LP deposits 1,010 liquidity 100 times

    let gasFor100mints = toBn("0");
    for (let i = 0; i < 100; i++) {
      console.log("mint phase: ", i);
      for (const p of this.positions) {
        await this.e2eSetup.mint(p[0], p[1], p[2], toBn("1001"));
        console.log(
          "gas consumed for mint: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
        gasFor100mints = gasFor100mints.add(
          await this.e2eSetup.getGasConsumedAtLastTx()
        );
      }
    }
    console.log(
      "gas consumed for 500 mints in average: ",
      gasFor100mints.div(100).toString()
    );

    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(25), 1, 1.0012);

    await this.exportSnapshot("AFTER 100 MINT PHASES");

    for (const p of this.positions) {
      await this.e2eSetup.updatePositionMargin(p[0], p[1], p[2], toBn("100"));
      console.log(
        "gas consumed for update position margin: ",
        (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
      );
    }

    const sqrtPriceLimit = await this.testTickMath.getSqrtRatioAtTick(
      -TICK_SPACING
    );

    let gasFor100swaps = toBn("0");
    for (let i = 0; i < 100; i++) {
      console.log("swap phase: ", i);
      for (const p of this.positions) {
        await this.e2eSetup.swap({
          recipient: p[0],
          amountSpecified: toBn("-3"),
          sqrtPriceLimitX96: sqrtPriceLimit,

          tickLower: p[1],
          tickUpper: p[2],
        });

        console.log(
          "gas consumed for swap: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
        gasFor100swaps = gasFor100swaps.add(
          await this.e2eSetup.getGasConsumedAtLastTx()
        );
      }
    }
    console.log(
      "gas consumed for 500 swaps in average: ",
      gasFor100swaps.div(500).toString()
    );

    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(25), 1, 1.0015);

    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 1);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 1);
  const e2eParams = e2eScenarios[1];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario1/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[1].skipped) {
  it.skip("scenario 1", test);
} else {
  it("scenario 1", test);
}
