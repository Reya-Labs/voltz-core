import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { random } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { MIN_SQRT_RATIO } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.marginEngineTest.setLiquidatorReward(toBn("0.5"));
    await this.exportSnapshot("START");

    // add 1,000,000 liquidity to Position 0

    // print the position margin requirement
    await this.getAPYboundsAndPositionMargin(this.positions[0]);

    // update the position margin with 210
    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("210")
    );

    // add 1,000,000 liquidity to Position 0
    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );

    // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
    await this.exportSnapshot("BEFORE FIRST SWAP");

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMargin(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("1000")
    );

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.getVT("below");

    await this.e2eSetup.swap({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-1000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      
      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    let accumulatedReserveNormalizedIncome = 1.0001;
    for (let i = 0; i < 89; i++) {
      await this.exportSnapshot("step " + i.toString());

      accumulatedReserveNormalizedIncome += random(0.0004, 0.0008);
      await this.advanceAndUpdateApy(
        consts.ONE_DAY,
        1,
        accumulatedReserveNormalizedIncome
      );
      await this.updateAPYbounds();
      console.log("historical apy:", utils.formatEther(this.historicalApyWad));
      console.log(
        "variable factor:",
        utils.formatEther(this.variableFactorWad)
      );

      await this.marginEngineTest.isLiquidatablePositionTest(
        this.positions[0][0],
        this.positions[0][1],
        this.positions[0][2]
      );
      const isLiquidatable = await this.marginEngineTest.getIsLiquidatable();

      if (isLiquidatable) {
        await this.e2eSetup.liquidatePosition(
          this.positions[3][1],
          this.positions[3][2],
          this.positions[3][0],
          this.positions[0][1],
          this.positions[0][2],
          this.positions[0][0]
        );
        console.log("is liquidatable");
        break;
      }
    }

    await this.exportSnapshot("AFTER LIQUIDATION TRIAL");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90), 2);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 7);
  const e2eParams = e2eScenarios[7];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario7/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[7].skipped) {
  it.skip("scenario 7", test);
} else {
  it("scenario 7", test);
}
