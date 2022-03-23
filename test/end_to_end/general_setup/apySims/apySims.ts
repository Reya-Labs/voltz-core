import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { random } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { add } from "../../../shared/functions";
import { TickMath } from "../../../shared/tickMath";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario\
  // 1M of notional
  NOTIONAL: BigNumber = toBn("1000000");

  async executeMint(positionIndex: number) {
    let marginRequirement: string = "";

    // check mint margin requirement
    await this.e2eSetup.callStatic
      .mintOrBurnViaPeriphery({
        marginEngine: this.marginEngineTest.address,
        tickLower: this.positions[positionIndex][1],
        tickUpper: this.positions[positionIndex][2],
        notional: this.NOTIONAL,
        isMint: true,
      })
      .then(
        (_: any) => {
          // marginRequirement = result;
          // DO nothing since the margin requirement is already fulfilled (since the simulation has passed)
        },
        (error: any) => {
          if (error.message.includes("MarginLessThanMinimum")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = args[0];
          } else {
            console.error(error);
          }
        }
      );

    console.log("marginRequirement", marginRequirement);
    if (!(marginRequirement === "")) {
      // update positioin margin to be equal to the requirement
      await this.e2eSetup.updatePositionMargin(
        this.positions[positionIndex][0],
        this.positions[positionIndex][1],
        this.positions[positionIndex][2],
        add(BigNumber.from(marginRequirement), toBn("1000"))
      );

      const local_fs = require("fs");
      local_fs.appendFileSync(
        "test/end_to_end/general_setup/apySims/margin_requirements.txt",
        "initial margin: " + utils.formatEther(marginRequirement) + "\n"
      );

      console.log("margin requirement:", utils.formatEther(marginRequirement));
    }

    // mint liquidity
    await this.e2eSetup.mintOrBurnViaPeriphery({
      marginEngine: this.marginEngineTest.address,
      tickLower: this.positions[positionIndex][1],
      tickUpper: this.positions[positionIndex][2],
      notional: this.NOTIONAL,
      isMint: true,
    });
  }

  async executeSwap(
    day: number,
    positionIndex: number,
    isFT: boolean,
    sqrtPriceLimitX96: string
  ) {
    let marginRequirement: string = "";
    let cumulativeFees: string = "";

    // check swap margin requirement
    await this.e2eSetup.callStatic
      .swapViaPeriphery({
        marginEngine: this.marginEngineTest.address,
        isFT: isFT,
        notional: this.NOTIONAL,
        sqrtPriceLimitX96: sqrtPriceLimitX96,
        tickLower: this.positions[positionIndex][1],
        tickUpper: this.positions[positionIndex][2],
      })
      .then(
        // todo: add interface for the result to avoid using [] notation to query result elements
        async (result) => {
          // console.log(result);
          marginRequirement = result[0].toString();
          cumulativeFees = result[1].toString();

          // Do nothing since the margin requirement is already satisfied (proven by a successful simulation of the swap)
        },
        (error: any) => {
          if (error.message.includes("MarginRequirementNotMet")) {
            const args: string[] = error.message
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = args[0];
            cumulativeFees = args[4];
          } else {
            console.error(error.message);
            // console.log(error.message)
          }
        }
      );

    console.log(
      "swap margin requirement:",
      utils.formatEther(marginRequirement)
    );

    if (!(marginRequirement === "")) {
      // todo: add logic that checks the current position margin and only deposits positive margin delta if required
      // the logic below always deposits +marginRequirement
      // update positioin margin to be equal to the requirement + fees
      await this.e2eSetup.updatePositionMargin(
        this.positions[positionIndex][0],
        this.positions[positionIndex][1],
        this.positions[positionIndex][2],
        add(
          add(
            BigNumber.from(marginRequirement),
            BigNumber.from(cumulativeFees)
          ),
          toBn("1000")
        ) // add margin requirement and fees to get the amount to deposit
      );
    }

    const local_fs = require("fs");
    local_fs.appendFileSync(
      "test/end_to_end/general_setup/apySims/fees.txt",
      "day " + day.toString() + " : " + utils.formatEther(cumulativeFees) + "\n"
    );

    // swap
    await this.e2eSetup.swapViaPeriphery({
      marginEngine: this.marginEngineTest.address,
      isFT: isFT,
      notional: this.NOTIONAL,
      sqrtPriceLimitX96: sqrtPriceLimitX96,
      tickLower: this.positions[positionIndex][1],
      tickUpper: this.positions[positionIndex][2],
    });
  }

  override async run() {
    await this.exportSnapshot("START");

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.increaseObservationCardinalityNext(2000);
    await this.rateOracleTest.increaseObservationCardinalityNext(3000);
    await this.rateOracleTest.increaseObservationCardinalityNext(4000);

    const local_fs = require("fs");
    local_fs.writeFileSync(
      "test/end_to_end/general_setup/apySims/fees.txt",
      ""
    );
    local_fs.writeFileSync(
      "test/end_to_end/general_setup/apySims/margin_requirements.txt",
      ""
    );

    let acc = 1.001;
    const min_rate_once = -0.0007;
    const max_rate_once = 0.001;
    const rate_oracle_loading_days = 10;
    for (let i = 0; i < rate_oracle_loading_days; i++) {
      for (let j = 0; j < 4; j++) {
        acc += random(min_rate_once, max_rate_once);
        await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc);
      }
    }

    await this.executeMint(0);

    // advance one day per step
    for (
      let i = rate_oracle_loading_days;
      i < rate_oracle_loading_days + 353;
      i++
    ) {
      console.log("day", i);
      await this.exportSnapshot("step " + i.toString());

      await this.executeSwap(
        i,
        1,
        true,
        TickMath.getSqrtRatioAtTick(this.positions[0][2]).toString()
      );
      // reverse swap
      await this.executeSwap(
        i,
        1,
        false,
        TickMath.getSqrtRatioAtTick(this.positions[0][1]).toString()
      );

      const minter_position_margin_requirement =
        await this.marginEngineTest.callStatic.getPositionMarginRequirement(
          this.positions[0][0],
          this.positions[0][1],
          this.positions[0][2],
          false
        );
      const minter_liquidation_threshold =
        await this.marginEngineTest.callStatic.getPositionMarginRequirement(
          this.positions[0][0],
          this.positions[0][1],
          this.positions[0][2],
          true
        );

      // console.log("after: ", utils.formatEther(minter_position_margin_requirement));

      local_fs.appendFileSync(
        "test/end_to_end/general_setup/apySims/margin_requirements.txt",
        "day " +
          i.toString() +
          " : " +
          utils.formatEther(minter_position_margin_requirement.toString()) +
          " , " +
          utils.formatEther(minter_liquidation_threshold.toString()) +
          "\n"
      );

      for (let j = 0; j < 4; j++) {
        acc += random(min_rate_once, max_rate_once);
        await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc);
      }
    }

    // export snapshot before settlement
    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(360), 4);

    // settle positions and traders
    await this.settlePositions();
    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 12);
  const e2eParams = e2eScenarios[12];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/apySims/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[12].skipped) {
  it.skip("scenario 12 (apy sims)", test);
} else {
  it("scenario 12 (apy sims)", test);
}
