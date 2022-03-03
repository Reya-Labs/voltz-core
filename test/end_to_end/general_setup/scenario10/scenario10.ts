import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { MAX_SQRT_RATIO, MIN_SQRT_RATIO } from "../../../shared/utilities";
import { e2eScenarios } from "../e2eSetup";
import { ScenarioRunner } from "../general";

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    // add 1,000,000 liquidity to Position 0

    // print the position margin requirement
    await this.getAPYboundsAndPositionMargin(this.positions[0]);

    // update the position margin with 210
    await this.e2eSetup.updatePositionMargin(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("420")
    );
    console.log(
      "gas consumed at update position margin: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    // add 1,000,000 liquidity to Position 0
    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );
    console.log(
      "gas consumed at first mint: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    // two days pass and set reserve normalised income
    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(2), 1, 1.0081); // advance 2 days

    // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
    await this.exportSnapshot("BEFORE FIRST SWAP");

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMargin(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("2000")
    );
    console.log(
      "gas consumed at update position margin: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.getVT("below");

    // Trader 0 buys 2,995 VT
    await this.e2eSetup.swap({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-2995"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      isExternal: false,
      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });
    console.log(
      "gas consumed at first swap: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    await this.exportSnapshot("AFTER FIRST SWAP");

    await this.updateCurrentTick();

    // one week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.01);

    // add 5,000,000 liquidity to Position 1

    // print the position margin requirement
    await this.getAPYboundsAndPositionMargin(this.positions[1]);

    // update the position margin with 2,000
    await this.e2eSetup.updatePositionMargin(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("4000")
    );
    console.log(
      "gas consumed at update position margin: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    // add 5,000,000 liquidity to Position 1
    await this.e2eSetup.mint(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("5000000")
    );
    console.log(
      "gas consumed at second mint: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    // a week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.0125);

    // Trader 1 engages in a swap
    await this.exportSnapshot("BEFORE SECOND SWAP");

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMargin(
      this.positions[3][0],
      this.positions[3][1],
      this.positions[3][2],
      toBn("2000")
    );
    console.log(
      "gas consumed at update position margin: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.getVT("below");

    // Trader 1 buys 15,000 VT
    await this.e2eSetup.swap({
      recipient: this.positions[3][0],
      amountSpecified: toBn("-15000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      isExternal: false,
      tickLower: this.positions[3][1],
      tickUpper: this.positions[3][2],
    });
    console.log(
      "gas consumed at second swap: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    await this.exportSnapshot("AFTER SECOND SWAP");

    // Trader 0 engages in a reverse swap
    await this.exportSnapshot("BEFORE THIRD (REVERSE) SWAP");

    // Trader 0 sells 10,000 VT
    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      this.positions[2][0],
      toBn("10000"),
      BigNumber.from(MAX_SQRT_RATIO.sub(1))
    );

    await this.exportSnapshot("AFTER THIRD (REVERSE) SWAP");

    // await this.e2eSetup.unwindFullyCollateralisedFixedTakerSwap(
    //   this.positions[2][0],
    //   toBn("10000"),
    //   BigNumber.from(MIN_SQRT_RATIO.add(1))
    // );

    // await this.exportSnapshot("AFTER UNWINDING THIRD (REVERSE) SWAP");

    await this.updateCurrentTick();

    // two weeks pass
    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(2), 2, 1.013); // advance two weeks

    // burn all liquidity of Position 0
    await this.e2eSetup.burn(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );
    console.log(
      "gas consumed at first burn: ",
      (await this.e2eSetup.getGasConsumedAtLastTx()).toString()
    );

    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(8), 4, 1.0132); // advance eight weeks (4 days before maturity)

    await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 10);
  const e2eParams = e2eScenarios[10];
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario10/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

if (e2eScenarios[10].skipped) {
  it.skip("scenario 10", test);
} else {
  it("scenario 10", test);
}
