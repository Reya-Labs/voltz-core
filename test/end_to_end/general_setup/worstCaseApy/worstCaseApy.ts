import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { encodeSqrtRatioX96, MAX_SQRT_RATIO } from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { poolConfigs } from "../../../../deployConfig/poolConfig";
import {
  MarginEngine,
  MarginEngineExact,
  MarginEngineLinear,
} from "../../../../typechain";

// aDAI v2 pool configuration
const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(2),
  numActors: 2,
  marginCalculatorParams: poolConfigs.aDAI.marginCalculatorParams,
  lookBackWindowAPY: BigNumber.from(poolConfigs.aDAI.lookbackWindowInSeconds),
  startingPrice: encodeSqrtRatioX96(1, 2),
  feeProtocol: 0,
  fee: BigNumber.from(poolConfigs.aDAI.feeWad),
  tickSpacing: poolConfigs.aDAI.tickSpacing,
  positions: [
    [0, -6960, 6960],
    [1, -60, 60],
  ],
  rateOracle: 1,
};

const MODE: 0 | 1 | 2 = 2;

// TODO: put all margin requirements into a file (and ignore it in git)

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

    const gas = await this.e2eSetup.estimateGas.mintOrBurnViaPeriphery(
      p[0],
      mintOrBurnParameters
    );
    console.log("-------Gas of LP:", gas.toString());
    console.log();

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
    switch (MODE) {
      case 0: {
        break;
      }
      case 1: {
        const marginEngineFactory = await ethers.getContractFactory(
          "MarginEngineLinear"
        );
        const newMarginEngine =
          (await marginEngineFactory.deploy()) as MarginEngineLinear;

        await (this.marginEngine as MarginEngine).upgradeTo(
          newMarginEngine.address
        );
        break;
      }
      case 2: {
        const marginEngineFactory = await ethers.getContractFactory(
          "MarginEngineExact"
        );
        const newMarginEngine =
          (await marginEngineFactory.deploy()) as MarginEngineExact;

        await (this.marginEngine as MarginEngine).upgradeTo(
          newMarginEngine.address
        );
        break;
      }
      default: {
        throw new Error(`Unrecognised MODE ${MODE}`);
      }
    }

    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    const p = this.positions[0];

    const startRate = await this.rateOracle.getCurrentRateInRay();
    console.log("start rate:", startRate.toString());

    const change = toBn("0.00002", 27);

    const fs = require("fs");
    const file = `test/end_to_end/general_setup/worstCaseApy/behaviour_${MODE}.csv`;

    const header = "time,historical_apy,margin,liquidation,safety";

    fs.writeFile(file, header + "\n", () => {});
    console.log(header);

    let openedLP = false;
    // let performedSwap = false;

    for (let i = 0; i < 59 * 4; i++) {
      await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 2);
      await this.e2eSetup.setNewRate(startRate.add(change.mul(i + 1)));

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

      continue;

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

it("worst case apy analysis", test);
