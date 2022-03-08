import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { add } from "../../../shared/functions";
import { TickMath } from "../../../shared/tickMath";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario
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

      console.log("margin requirement:", utils.formatEther(marginRequirement));
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
        async (_: any) => {
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
        add(BigNumber.from(marginRequirement), BigNumber.from(cumulativeFees)) // add margin requirement and fees to get the amount to deposit
      );
    }

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

    await this.executeMint(0);

    // advance one day per step
    for (let i = 0; i < 364; i++) {
      console.log("day", i);
      await this.exportSnapshot("step " + i.toString());

      await this.executeSwap(
        1,
        true,
        TickMath.getSqrtRatioAtTick(this.positions[0][2]).toString()
      );
      // reverse swap
      await this.executeSwap(
        1,
        false,
        TickMath.getSqrtRatioAtTick(this.positions[0][1]).toString()
      );

      await this.advanceAndUpdateApy(consts.ONE_DAY, 1, 1.001 + i * 0.0001);
    }

    // export snapshot before settlement
    await this.exportSnapshot("BEFORE SETTLEMENT");

    // await advanceTime(40);

    // settle positions and traders
    // await this.settlePositions();
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
