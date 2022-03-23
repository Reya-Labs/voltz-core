import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);

    const liquidityDeltaBn = toBn("100000");

    let marginRequirement = BigNumber.from("0");
    await this.e2eSetup.callStatic
      .mint(
        this.positions[0][0],
        this.positions[0][1],
        this.positions[0][2],
        liquidityDeltaBn
      )
      .then(
        () => {},
        (error) => {
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("MarginLessThanMinimum")[1]
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = BigNumber.from(args[0]);
          }
        }
      );

    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      marginRequirement.add(toBn("1"))
    );

    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      liquidityDeltaBn
    );

    // const max_vt_fcm = Math.floor(await this.getVT("above"));
    // const amount_fcm = randomInt(1, max_vt_fcm);
    // console.log("to fcm swap vt:", 0, "->", amount_fcm, "->", max_vt_fcm);

    await this.e2eSetup.updatePositionMargin(
      this.positions[5][0],
      this.positions[5][1],
      this.positions[5][2],
      toBn("10000")
    );

    // const min_vt = -Math.floor(await this.getVT("below"));
    // const max_vt = Math.floor(await this.getVT("above"));
    // const amount = randomInt(min_vt, max_vt);
    // console.log("vt:", min_vt, "->", amount, "->", max_vt);

    const amount_fcm = 150;
    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      this.positions[5][0],
      toBn(amount_fcm.toString()),
      await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );

    const amount = -300;
    await this.e2eSetup.swap({
      recipient: this.positions[5][0],
      amountSpecified: toBn(amount.toString()),
      sqrtPriceLimitX96:
        amount > 0
          ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
          : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),
      tickLower: this.positions[5][1],
      tickUpper: this.positions[5][2],
    });

    for (let i = 0; i < 88; i++) {
      await this.advanceAndUpdateApy(
        consts.ONE_DAY.mul(1),
        1,
        1.003 + i * 0.0025
      );
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90), 2);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 13);
  const e2eParams = e2eScenarios[13];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario13/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[13].skipped) {
  it.skip("scenario 13", test);
} else {
  it("scenario 13", test);
}
