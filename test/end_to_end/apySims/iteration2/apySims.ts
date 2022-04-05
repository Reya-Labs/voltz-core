import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../../helpers/time";
import { add } from "../../../../shared/functions";
import { TickMath } from "../../../../shared/tickMath";
import { MAX_TICK, MIN_TICK } from "../../../../shared/utilities";
import { e2eScenarios } from "../../e2eSetup";
import { ScenarioRunner } from "../../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario\
  // 1M of notional
  NOTIONAL: BigNumber = toBn("1000000");
  RANGE_SIZE: number = 0.08;
  LP_REBALANCE_PERIOD_IN_DAYS = 7;
  deposited_amount = toBn("0");
  current_amount = toBn("0");

  async executeMint() {
    let marginRequirement: string = "";
    const lower_fixed_rate = Math.max(
      parseFloat(utils.formatEther(this.historicalApyWad)) -
        this.RANGE_SIZE / 2,
      0
    );
    const upper_fixed_rate =
      parseFloat(utils.formatEther(this.historicalApyWad)) +
      this.RANGE_SIZE / 2;
    console.log(
      utils.formatEther(this.historicalApyWad),
      lower_fixed_rate,
      upper_fixed_rate
    );
    const tickLower =
      Math.floor(-(Math.log(upper_fixed_rate * 100) / Math.log(1.0001)) / 60) *
      60;
    const tickUpper =
      Math.floor(-(Math.log(lower_fixed_rate * 100) / Math.log(1.0001)) / 60) *
      60;
    console.log(tickLower, tickUpper);

    const recipient = this.positions[0][0];
    this.positions.push([recipient, tickLower, tickUpper]);
    console.log(this.positions.length);

    // check mint margin requirement
    await this.e2eSetup.callStatic
      .mintOrBurnViaPeriphery({
        marginEngineAddress: this.marginEngineTest.address,
        recipient: this.positions[this.positions.length - 1][0],
        tickLower: this.positions[this.positions.length - 1][1],
        tickUpper: this.positions[this.positions.length - 1][2],
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

      if (
        add(BigNumber.from(marginRequirement), toBn("1000")).gt(
          this.current_amount
        )
      ) {
        this.deposited_amount = this.deposited_amount.add(
          add(BigNumber.from(marginRequirement), toBn("1000")).sub(
            this.current_amount
          )
        );
        this.current_amount = add(
          BigNumber.from(marginRequirement),
          toBn("1000")
        );
      }

      console.log("current margin:", utils.formatEther(this.current_amount));
      await this.e2eSetup.setIntegrationApproval(
        this.positions[this.positions.length - 1][0],
        this.e2eSetup.address,
        true
      );
      await this.e2eSetup.updatePositionMargin(
        this.positions[this.positions.length - 1][0],
        this.positions[this.positions.length - 1][1],
        this.positions[this.positions.length - 1][2],
        this.current_amount
      );
      this.current_amount = toBn("0");
    }

    // mint liquidity
    await this.e2eSetup.mintOrBurnViaPeriphery({
      marginEngineAddress: this.marginEngineTest.address,
      recipient: this.positions[this.positions.length - 1][0],
      tickLower: this.positions[this.positions.length - 1][1],
      tickUpper: this.positions[this.positions.length - 1][2],
      notional: this.NOTIONAL,
      isMint: true,
    });
  }

  async executeBurn() {
    // burn liquidity
    await this.e2eSetup.mintOrBurnViaPeriphery({
      marginEngineAddress: this.marginEngineTest.address,
      recipient: this.positions[this.positions.length - 1][0],
      tickLower: this.positions[this.positions.length - 1][1],
      tickUpper: this.positions[this.positions.length - 1][2],
      notional: this.NOTIONAL,
      isMint: false,
    });

    const margin = (
      await this.marginEngineTest.getPosition(
        this.positions[this.positions.length - 1][0],
        this.positions[this.positions.length - 1][1],
        this.positions[this.positions.length - 1][2]
      )
    ).margin;

    await this.e2eSetup.setIntegrationApproval(
      this.positions[this.positions.length - 1][0],
      this.e2eSetup.address,
      true
    );
    await this.e2eSetup.updatePositionMargin(
      this.positions[this.positions.length - 1][0],
      this.positions[this.positions.length - 1][1],
      this.positions[this.positions.length - 1][2],
      margin.mul(-1).add(toBn("100"))
    );

    this.current_amount = margin;
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
      await this.e2eSetup.setIntegrationApproval(
        this.positions[this.positions.length - 1][0],
        this.e2eSetup.address,
        true
      );
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

      console.log(
        "swap margin requirement:",
        utils.formatEther(marginRequirement)
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

    for (let i = 0; i < days * 4; i++) {
      const f = async () => {
        await this.advanceAndUpdateApy(
          consts.ONE_HOUR.mul(6),
          1,
          1.5 + (0.5 * i) / (365 * 4)
        );
      };
      events.push([consts.ONE_HOUR.mul(6).mul(i + 1), f]);
    }

    for (let i = 10; i < days; i += this.LP_REBALANCE_PERIOD_IN_DAYS) {
      const f = async () => {
        await this.executeMint();
      };
      events.push([consts.ONE_DAY.mul(i).add(1), f]);
    }

    for (let i = 10; i < days; i += 7) {
      const f = async () => {
        await this.executeBurn();
      };
      events.push([consts.ONE_DAY.mul(i + 1).sub(1), f]);
    }

    for (let i = 10; i < days; i += 1) {
      const f = async () => {
        await this.executeSwap(
          1,
          true,
          TickMath.getSqrtRatioAtTick(MAX_TICK - 1).toString()
        );
        // reverse swap
        await this.executeSwap(
          1,
          false,
          TickMath.getSqrtRatioAtTick(MIN_TICK + 1).toString()
        );
        await this.exportSnapshot("step " + (i + 1).toString());
      };
      events.push([consts.ONE_DAY.mul(i).add(2), f]);
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
    "test/end_to_end/general_setup/apySims/iteration2/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[12].skipped) {
  it.skip("scenario 12 (apy sims)", test);
} else {
  it("scenario 12 (apy sims)", test);
}
