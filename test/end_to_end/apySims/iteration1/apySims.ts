import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { random } from "mathjs";
import { consts } from "../../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../../helpers/time";
import { add } from "../../../../shared/functions";
import { TickMath } from "../../../../shared/tickMath";
import { e2eScenarios } from "../../e2eSetup";
import { ScenarioRunner } from "../../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario\
  // 1M of notional
  NOTIONAL: BigNumber = toBn("1000000");

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

    console.log("marginRequirement", marginRequirement);
    if (!(marginRequirement === "")) {
      // update positioin margin to be equal to the requirement
      await this.e2eSetup.updatePositionMargin(
        this.positions[positionIndex][0],
        this.positions[positionIndex][1],
        this.positions[positionIndex][2],
        add(BigNumber.from(marginRequirement), toBn("1000"))
      );
    }

    // mint liquidity
    await this.e2eSetup.mintOrBurnViaPeriphery({
      marginEngineAddress: this.marginEngineTest.address,
      recipient: this.positions[positionIndex][0],
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
    await this.rateOracleTest.increaseObservationCardinalityNext(3000);
    await this.rateOracleTest.increaseObservationCardinalityNext(4000);
    await this.rateOracleTest.increaseObservationCardinalityNext(5000);
    await this.rateOracleTest.increaseObservationCardinalityNext(6000);

    let events: [BigNumber, () => Promise<void>][] = [];
    const days = 360;

    let time = toBn("0");
    let acc_rni = 1.5;
    const min_delta_rni = -0.00015;
    const max_delta_rni = 0.00025;

    for (let i = 0; i < days * 4; i++) {
      time = time.add(consts.ONE_HOUR.mul(6));
      const f = async () => {
        acc_rni += random(min_delta_rni, max_delta_rni);
        await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc_rni);
      };
      events.push([time, f]);
    }

    time = consts.ONE_DAY.mul(10).add(1);

    const f = async () => {
      await this.executeMint(0);
    };
    events.push([consts.ONE_DAY.mul(10).add(1), f]);

    for (let i = 10; i < days; i++) {
      time = time.add(consts.ONE_DAY);
      const f = async () => {
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
      };
      events.push([time, f]);
    }

    events = events.sort((a, b) => {
      if (b[0].gt(a[0])) {
        return -1;
      }
      if (a[0].gt(b[0])) {
        return 1;
      }
      return 0;
    });

    for (let i = 0; i < events.length; i++) {
      console.log("action", i + 1, "of", events.length);
      await events[i][1]();
      await this.exportSnapshot("step " + (i + 1).toString());
    }

    // export snapshot before settlement
    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(380), 4);

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
    "test/end_to_end/general_setup/apySims/iteration1/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[12].skipped) {
  it.skip("scenario 12 (apy sims)", test);
} else {
  it("scenario 12 (apy sims)", test);
}
