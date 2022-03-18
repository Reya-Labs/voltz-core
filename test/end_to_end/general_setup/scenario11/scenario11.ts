import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { randomInt } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TICK_SPACING } from "../../../shared/utilities";
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

    const length_of_series = 10;
    const actions = [1, 2, 3, 4, 5];

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.increaseObservationCardinalityNext(2000);

    for (let step = 0; step < length_of_series * 4; step++) {
      // await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);
      await this.advanceAndUpdateApy(
        consts.ONE_HOUR.mul(6),
        1,
        1.0001 + step * 0.00001
      );

      const action = step < 5 ? 1 : actions[randomInt(0, actions.length)];
      await this.exportSnapshot(
        "step: " + step.toString() + " / action: " + action.toString()
      );

      console.log(action);
      if (action === 1) {
        // position mint
        const p = this.positions[randomInt(0, 5)];
        const liquidityDelta = randomInt(10000, 100000);
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        let marginRequirement = BigNumber.from("0");
        await this.e2eSetup.callStatic
          .mint(p[0], p[1], p[2], liquidityDeltaBn)
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
              } else {
                console.log(error);
              }
            }
          );

        await this.e2eSetup.updatePositionMargin(
          p[0],
          p[1],
          p[2],
          marginRequirement.add(toBn("1"))
        );
        console.log(
          "gas consumed for update position margin: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );

        await this.e2eSetup.mint(p[0], p[1], p[2], liquidityDeltaBn);
        console.log(
          "gas consumed for mint: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }

      if (action === 2) {
        // position burn
        const p = this.positions[randomInt(0, 5)];
        console.log("here?");
        const current_liquidity =
          (await this.marginEngineTest.callStatic.getPosition(p[0], p[1], p[2]))._liquidity
            .div(BigNumber.from(10).pow(12))
            .toNumber() /
          10 ** 6;
        const liquidityDelta = randomInt(0, Math.floor(current_liquidity));
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        if (liquidityDelta <= 0) continue;

        await this.e2eSetup.burn(p[0], p[1], p[2], liquidityDeltaBn);
        console.log(
          "gas consumed for burn: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }

      if (action === 3) {
        // trader swap
        const p = this.positions[randomInt(5, 8)];

        const min_vt = -Math.floor(await this.getVT("below"));
        const max_vt = Math.floor(await this.getVT("above"));
        const amount = randomInt(min_vt, max_vt);
        console.log("vt:", min_vt, "->", amount, "->", max_vt);

        if (amount === 0) continue;

        await this.e2eSetup.swap({
          recipient: p[0],
          amountSpecified: toBn(amount.toString()),
          sqrtPriceLimitX96:
            amount > 0
              ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
              : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),
          tickLower: p[1],
          tickUpper: p[2],
        });
        console.log(
          "gas consumed for swap: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }

      if (action === 4) {
        // trader fcm swap
        const p = this.positions[randomInt(5, 8)];

        const max_vt = Math.floor(await this.getVT("above"));
        const amount = randomInt(0, max_vt);
        console.log("to fcm swap vt:", 0, "->", amount, "->", max_vt);

        if (amount === 0) continue;

        await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
          p[0],
          toBn(amount.toString()),
          await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
        );
        console.log(
          "gas consumed for fcm swap: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }

      if (action === 5) {
        // trader fcm unwind
        const p = this.positions[randomInt(5, 8)];

        const traderYBAInfo = this.fcmTest.getTraderWithYieldBearingAssets(
          p[0]
        );

        const min_vt = Math.floor(await this.getVT("below"));
        const amount = randomInt(
          0,
          Math.min(
            min_vt,
            -Math.floor(
              parseFloat(
                utils.formatEther((await traderYBAInfo).variableTokenBalance)
              )
            )
          )
        );
        console.log("to fcm unwind vt:", 0, "->", amount, "->", min_vt);

        if (amount === 0) continue;

        await this.e2eSetup.unwindFullyCollateralisedFixedTakerSwap(
          p[0],
          toBn(amount.toString()),
          await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING)
        );
        console.log(
          "gas consumed for fcm unwind: ",
          (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
        );
      }
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90 - length_of_series), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 11);
  const e2eParams = e2eScenarios[11];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario11/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[11].skipped) {
  it.skip("scenario 11", test);
} else {
  it("scenario 11", test);
}
