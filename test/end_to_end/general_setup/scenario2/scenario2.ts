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
      {
        owner: this.positions[0][0],
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        liquidityDelta: 0,
      },
      toBn("21000")
    );

    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("100000000")
    );

    await this.e2eSetup.updateTraderMargin(this.traders[0], toBn("1000"));

    await this.e2eSetup.swap({
      recipient: this.traders[0],
      isFT: false,
      amountSpecified: toBn("-2000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      isUnwind: false,
      isTrader: true,
      tickLower: 0,
      tickUpper: 0,
    });

    await this.e2eSetup.updateTraderMargin(this.traders[1], toBn("1000"));

    await this.e2eSetup.swap({
      recipient: this.traders[1],
      isFT: true,
      amountSpecified: toBn("2000"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
      isUnwind: false,
      isTrader: true,
      tickLower: 0,
      tickUpper: 0,
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
    await this.settlePositionsAndTraders(this.positions, this.traders);

    await this.exportSnapshot("FINAL");
  }
}

it("scenario 2", async () => {
  console.log("scenario", 2);
  const e2eParams = e2eScenarios[2];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario2/console.txt"
  );
  await scenario.init();
  await scenario.run();
});
