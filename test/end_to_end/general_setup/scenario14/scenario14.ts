import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
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

    await this.marginEngineTest.setSecondsAgo(consts.ONE_WEEK);
    await this.marginEngineTest.setCacheMaxAgeInSeconds(consts.ONE_DAY);

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);

    for (let i = 0; i < 15; i++) {
      await this.advanceAndUpdateApy(consts.ONE_DAY, 2, 1 + (i + 1) / 3650);
    }

    console.log(
      utils.formatEther(
        await this.marginEngineTest.callStatic.getHistoricalApy()
      )
    );

    const p = this.positions[0];
    const positionMarginRequirement = BigNumber.from(0);

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

    await this.e2eSetup.mint(p[0], p[1], p[2], toBn("100000"));
    console.log(
      "gas consumed for mint: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 14);
  const e2eParams = e2eScenarios[11];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario14/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it.skip("scenario 14", test);
