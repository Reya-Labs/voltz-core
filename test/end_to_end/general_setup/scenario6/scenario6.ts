import { utils } from "ethers";
import { toBn } from "evm-bn";
import { random } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { encodePriceSqrt } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);

    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("400000")
    );

    await this.e2eSetup.updatePositionMargin(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("400000")
    );

    await this.e2eSetup.updatePositionMargin(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("400000")
    );

    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("10000000")
    );
    await this.e2eSetup.mint(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("10000000")
    );

    await this.exportSnapshot("available amounts");

    let accumulatedReserveNormalizedIncome = 1.0001;
    for (let i = 0; i < 89; i++) {
      await this.e2eSetup.swap({
        recipient: this.positions[2][0],
        amountSpecified: toBn("-16506"),
        sqrtPriceLimitX96: encodePriceSqrt(1, 10),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
      });

      accumulatedReserveNormalizedIncome += random(0.0003, 0.0006);
      await this.advanceAndUpdateApy(
        consts.ONE_DAY.mul(4),
        4,
        accumulatedReserveNormalizedIncome
      );
      await this.updateAPYbounds();
      console.log(" historical apy:", utils.formatEther(this.historicalApyWad));
      console.log(
        "variable factor:",
        utils.formatEther(this.variableFactorWad)
      );

      await this.exportSnapshot("AFTER step " + i.toString());
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(15), 10);

    // variable factor at maturity: ~3%
    // minter 1 traded liquidity at average ~7%
    // minter 2 traded liqudiity at average ~8%
    // settlement cashflow minter 2 / settlement cashflow minter 1 ~ (8-3)/(7-3) checked

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 6);
  const e2eParams = e2eScenarios[6];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario6/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[6].skipped) {
  it.skip("scenario 6", test);
} else {
  it("scenario 6", test);
}
