import { utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    for (let i = 0; i < 89; i++) {
      await this.advanceAndUpdateApy(consts.ONE_DAY, 1, 1.0001 + i * 0.0002);
      await this.updateAPYbounds();
      console.log("historical apy:", utils.formatEther(this.historicalApyWad));
    }

    await advanceTimeAndBlock(consts.ONE_DAY, 1);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

it("scenario 6", async () => {
  console.log("scenario", 6);
  const e2eParams = e2eScenarios[6];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario6/console.txt"
  );
  await scenario.init();
  await scenario.run();
});
