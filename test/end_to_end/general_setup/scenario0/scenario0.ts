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
      await this.printAPYboundsAndPositionMargin(
        this.positions[0],
        toBn("1000000")
      );
  
      // update the position margin with 210
      await this.e2eSetup.updatePositionMargin(
        {
          owner: this.positions[0][0],
          tickLower: this.positions[0][1],
          tickUpper: this.positions[0][2],
          liquidityDelta: toBn("0"),
        },
        toBn("210")
      );
  
      // add 1,000,000 liquidity to Position 0
      await this.e2eSetup.mint(
        this.positions[0][0],
        this.positions[0][1],
        this.positions[0][2],
        toBn("1000000")
      );
  
      // two days pass and set reserve normalised income
      await this.advanceAndUpdateApy(consts.ONE_DAY.mul(2), 1, 1.0081); // advance 2 days
  
      // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
      await this.exportSnapshot("BEFORE FIRST SWAP");
  
      // update the trader margin with 1,000
      await this.e2eSetup.updateTraderMargin(this.traders[0], toBn("1000"));
  
      // print the maximum amount given the liquidity of Position 0
      await this.updateCurrentTick();
  
      await this.getAmounts("below");
  
      // Trader 0 buys 2,995 VT
      await this.e2eSetup.swap({
        recipient: this.traders[0],
        isFT: false,
        amountSpecified: toBn("-2995"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });

      await this.exportSnapshot("AFTER FIRST SWAP");
  
      await this.updateCurrentTick();
  
      // one week passes
      await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.01);
  
      // add 5,000,000 liquidity to Position 1

      // print the position margin requirement
      await this.printAPYboundsAndPositionMargin(
        this.positions[1],
        toBn("5000000")
      );
  
      // update the position margin with 2,000
      await this.e2eSetup.updatePositionMargin(
        {
          owner: this.positions[1][0],
          tickLower: this.positions[1][1],
          tickUpper: this.positions[1][2],
          liquidityDelta: 0,
        },
        toBn("2000")
      );
  
      // add 5,000,000 liquidity to Position 1
      await this.e2eSetup.mint(
        this.positions[1][0],
        this.positions[1][1],
        this.positions[1][2],
        toBn("5000000")
      );
  
      // a week passes
      await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.0125);
  
      // Trader 1 engages in a swap
      await this.exportSnapshot("BEFORE SECOND SWAP");
  
      // update the trader margin with 1,000
      await this.e2eSetup.updateTraderMargin(this.traders[1], toBn("1000"));
  
      // print the maximum amount given the liquidity of Position 0
      await this.updateCurrentTick();
  
      await this.getAmounts("below");
  
      // Trader 1 buys 15,000 VT
      await this.e2eSetup.swap({
        recipient: this.traders[1],
        isFT: false,
        amountSpecified: toBn("-15000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });
  
      await this.exportSnapshot("AFTER SECOND SWAP");
  
      // Trader 0 engages in a reverse swap
      await this.exportSnapshot("BEFORE THIRD (REVERSE) SWAP");
  
      // Trader 0 sells 10,000 VT
      await this.e2eSetup.swap({
        recipient: this.traders[0],
        isFT: true,
        amountSpecified: toBn("10000"),
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        isUnwind: false,
        isTrader: true,
        tickLower: 0,
        tickUpper: 0,
      });
  
      await this.exportSnapshot("AFTER THIRD (REVERSE) SWAP");
  
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
      // }
  
      await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(8), 4, 1.0132); // advance eight weeks (4 days before maturity)
  
      await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity
  
      // settle positions and traders
      await this.settlePositionsAndTraders(this.positions, this.traders);
  
      await this.exportSnapshot("FINAL");
    }
  }
  
    it("scenario 0", async () => {
    console.log("scenario", 0);
    const e2eParams = e2eScenarios[0];
    const scenario = new ScenarioRunnerInstance(e2eParams, "test/end_to_end/general_setup/scenario0/console.txt");
    await scenario.init();
    await scenario.run();
});
