import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { add } from "../../../shared/functions";
import { TickMath } from "../../../shared/tickMath";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario\
  // 100M of notional
  NOTIONAL: BigNumber = toBn("100000000");

  async executeMint(positionIndex: number) {
    let marginRequirement: string = "";

    // check mint margin requirement
    await this.e2eSetup.callStatic
      .mintOrBurnViaPeriphery({
        marginEngineAddress: this.marginEngineTest.address,
        recipient: this.positions[positionIndex][0],
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

    if (!(marginRequirement === "")) {
      // update positioin margin to be equal to the requirement
      await this.e2eSetup.updatePositionMargin(
        this.positions[positionIndex][0],
        this.positions[positionIndex][1],
        this.positions[positionIndex][2],
        marginRequirement
      );

      const local_fs = require("fs");
      local_fs.appendFileSync(
        "test/end_to_end/general_setup/apySims/margin_requirements.txt",
        "initial margin: " + utils.formatEther(marginRequirement) + "\n"
      );
    }

    // mint liquidity
    await this.e2eSetup.mintOrBurnViaPeriphery({
      marginEngineAddress: this.marginEngineTest.address,
      recipient: this.positions[positionIndex][0],
      tickLower: this.positions[positionIndex][1],
      tickUpper: this.positions[positionIndex][2],
      notional: this.NOTIONAL, // 100M of notional
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
        marginEngineAddress: this.marginEngineTest.address,
        recipient: this.positions[positionIndex][0],
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
          toBn("100")
        ) // add margin requirement and fees to get the amount to deposit
      );
    }

    const local_fs = require("fs");
    local_fs.appendFileSync(
      "test/end_to_end/general_setup/apySims/fees.txt",
      "day " + day.toString() + ":" + utils.formatEther(cumulativeFees) + "\n"
    );

    // swap
    await this.e2eSetup.swapViaPeriphery({
      marginEngineAddress: this.marginEngineTest.address,
      recipient: this.positions[positionIndex][0],
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

    const local_fs = require("fs");
    local_fs.writeFileSync(
      "test/end_to_end/general_setup/apySims/fees.txt",
      ""
    );
    local_fs.writeFileSync(
      "test/end_to_end/general_setup/apySims/margin_requirements.txt",
      ""
    );

    await this.executeMint(0);

    // advance one day per step
    for (let i = 0; i < 364; i++) {
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

      //   const minter_position_margin_requirement = await this.e2eSetup.callStatic.mintOrBurnViaPeriphery(this.positions[0][0], this.positions[0][1], this.positions[0][2], true, toBn("0.000001"));
      //   let minter_liquidation_threshold = 0;
      //   await this.marginEngineTest.callStatic
      //   .liquidatePosition(this.positions[1][1], this.positions[1][2], this.positions[1][0])
      //   .then(
      //     (_) => {
      //       console.log("on success");
      //     },
      //     (error) => {
      //       console.log("on revert");
      //       if (error.message.includes("CannotLiquidate")) {
      //         const args: string[] = error.message
      //           .split("(")[1]
      //           .split(")")[0]
      //           .replaceAll(" ", "")
      //           .split(",");

      //           minter_liquidation_threshold = parseFloat(utils.formatEther(args[0]));
      //       } else {
      //         console.error(error);
      //       }
      //     }
      //   );

      // local_fs.appendFileSync("test/end_to_end/general_setup/apySims/margin_requirements.txt", "day " + i.toString() + ":" + minter_position_margin_requirement.toString() + " , " + minter_liquidation_threshold.toString());

      await this.advanceAndUpdateApy(consts.ONE_DAY, 1, 1.001 + i * 0.0001);
    }

    // export snapshot before settlement
    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 4);

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
