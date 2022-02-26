import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { MAX_SQRT_RATIO, MIN_SQRT_RATIO } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("21000")
    );

    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("100000000")
    );

    await this.e2eSetup.updatePositionMargin(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("1000")
    );

    await this.e2eSetup.swap({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-2000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      isExternal: false,
      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    await this.e2eSetup.updatePositionMargin(
      this.positions[3][0],
      this.positions[3][1],
      this.positions[3][2],
      toBn("1000")
    );

    await this.e2eSetup.swap({
      recipient: this.positions[3][0],
      amountSpecified: toBn("2000"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
      isExternal: false,
      tickLower: this.positions[3][1],
      tickUpper: this.positions[3][2],
    });

    for (let i = 0; i < 89; i++) {
      await this.exportSnapshot("DAY " + i.toString());

      await this.advanceAndUpdateApy(
        consts.ONE_DAY.mul(1),
        1,
        1.001 + i * 0.0001
      );
    }

    this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 1);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 2);
  const e2eParams = e2eScenarios[2];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario2/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[2].skipped) {
  it.skip("scenario 2", test);
} else {
  it("scenario 2", test);
}
