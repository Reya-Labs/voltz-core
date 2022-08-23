import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { encodeSqrtRatioX96, MAX_SQRT_RATIO } from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { poolConfigs } from "../../../../deployConfig/poolConfig";

/// SCENARIO VARIABLE
// const LP_LOWER_TICK = -6960; // 2%
const LP_LOWER_TICK = -16080; // 5%

// const LP_UPPER_TICK = 6960; // 0.5%
const LP_UPPER_TICK = -13860; // 4%

// const STARTING_PRICE = encodeSqrtRatioX96(2, 1); // 0.5% starting fixed rate
// const STARTING_PRICE = encodeSqrtRatioX96(1, 2); // 2% starting fixed rate
const STARTING_PRICE = encodeSqrtRatioX96(1, 4); // 4% starting fixed rate
// const STARTING_PRICE = encodeSqrtRatioX96(2, 9); // 4.5% starting fixed rate
// const STARTING_PRICE = encodeSqrtRatioX96(1, 5); // 5% starting fixed rate
// const STARTING_PRICE = encodeSqrtRatioX96(1, 8); // 8% starting fixed rate

const CHANGE = toBn("0.00002", 27); // 2.93% historical apy
// const CHANGE = toBn("0.00005", 27); // 7.47% historical apy
// const CHANGE = toBn("0.0001", 27); // 15.47% historical apy
///

// aDAI v2 pool configuration
const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(2),
  numActors: 2,
  marginCalculatorParams: poolConfigs.aDAI.marginCalculatorParams,
  lookBackWindowAPY: BigNumber.from(poolConfigs.aDAI.lookbackWindowInSeconds),
  startingPrice: STARTING_PRICE,
  feeProtocol: 0,
  fee: BigNumber.from(poolConfigs.aDAI.feeWad),
  tickSpacing: poolConfigs.aDAI.tickSpacing,
  positions: [
    [0, LP_LOWER_TICK, LP_UPPER_TICK], // range of LP
    [1, -60, 60],
  ],
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  async openLPPosition() {
    const p = this.positions[0];
    const mintOrBurnParameters = {
      marginEngine: this.marginEngine.address,
      tickLower: p[1],
      tickUpper: p[2],
      notional: toBn("10000"),
      isMint: true,
      marginDelta: toBn("0"),
    };

    const requirement = await this.getMintInfoViaPeriphery(
      p[0],
      mintOrBurnParameters
    );

    console.log("initial requirement of LP position:", requirement);

    mintOrBurnParameters.marginDelta = toBn(requirement.toString());

    await this.e2eSetup.mintOrBurnViaPeriphery(p[0], mintOrBurnParameters);
  }

  async swapAgainstLP() {
    const p = this.positions[1];

    {
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: true,
        notional: toBn("5000"),
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: p[1],
        tickUpper: p[2],
        marginDelta: toBn("0"),
      };

      const swapInfo = await this.getInfoSwapViaPeriphery(p[0], swapParameters);

      swapParameters.marginDelta = toBn(swapInfo.marginRequirement.toString());

      await this.e2eSetup.swapViaPeriphery(p[0], swapParameters);
    }
  }

  override async run() {
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    const p = this.positions[0];

    const startRate = await this.rateOracle.getCurrentRateInRay();
    console.log("start rate:", startRate.toString());

    const fs = require("fs");
    const file = `test/end_to_end/general_setup/worstCaseApy/behaviour.csv`;

    const header = "time,historical_apy,margin,liquidation,safety";

    fs.writeFile(file, header + "\n", () => {});
    console.log(header);

    let openedLP = false;
    // let performedSwap = false;

    for (let i = 0; i < 59 * 4; i++) {
      await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 2);
      await this.e2eSetup.setNewRate(startRate.add(CHANGE.mul(i + 1)));

      if (i <= 7 * 4) {
        continue;
      }

      if (!openedLP) {
        // open LP position
        console.log();
        console.log();
        await this.openLPPosition();
        console.log();
        console.log();
        openedLP = true;
      }

      //   if (i >= 14 * 4) {
      //     if (!performedSwap) {
      //       await this.swapAgainstLP();
      //       performedSwap = true;
      //     }
      //   }

      const positionRequirementSafety =
        await this.marginEngine.callStatic.getPositionMarginRequirement(
          p[0],
          p[1],
          p[2],
          false
        );

      const positionRequirementLiquidation =
        await this.marginEngine.callStatic.getPositionMarginRequirement(
          p[0],
          p[1],
          p[2],
          true
        );

      const positionInfo = await this.marginEngine.callStatic.getPosition(
        p[0],
        p[1],
        p[2]
      );

      const historicalApy =
        await this.marginEngine.callStatic.getHistoricalApy();

      const scaledSafety = ethers.utils.formatEther(positionRequirementSafety);
      const scaledLiquidation = ethers.utils.formatEther(
        positionRequirementLiquidation
      );
      const scaledMargin = ethers.utils.formatEther(positionInfo.margin);
      const scaledHistoricalApy = ethers.utils.formatEther(historicalApy);

      console.log(
        i,
        scaledHistoricalApy,
        scaledMargin,
        scaledLiquidation,
        scaledSafety
      );
      fs.appendFileSync(
        file,
        `${i},${scaledHistoricalApy},${scaledMargin},${scaledLiquidation},${scaledSafety}\n`
      );
    }
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it.skip("worst case apy analysis", test);
