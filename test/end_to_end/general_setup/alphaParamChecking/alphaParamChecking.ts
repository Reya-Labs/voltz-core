import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import {
  encodeSqrtRatioX96,
  MAX_SQRT_RATIO,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  MIN_SQRT_RATIO,
  TICK_SPACING,
  T_MAX,
} from "../../../shared/utilities";
import { e2eParameters } from "../e2eSetup";
import { ScenarioRunner } from "../general";

const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(2),
  numActors: 4,
  marginCalculatorParams: {
    apyUpperMultiplierWad: toBn("2.0"),
    apyLowerMultiplierWad: toBn("0.1"),
    minDeltaLMWad: MIN_DELTA_LM,
    minDeltaIMWad: MIN_DELTA_IM,
    sigmaSquaredWad: toBn("0.0001"),
    alphaWad: toBn("0.2"),
    betaWad: toBn("0.2"),
    xiUpperWad: toBn("2"),
    xiLowerWad: toBn("98"),
    tMaxWad: T_MAX,

    devMulLeftUnwindLMWad: toBn("3"),
    devMulRightUnwindLMWad: toBn("3"),
    devMulLeftUnwindIMWad: toBn("6"),
    devMulRightUnwindIMWad: toBn("6"),

    fixedRateDeviationMinLeftUnwindLMWad: toBn("0.02"),
    fixedRateDeviationMinRightUnwindLMWad: toBn("0.02"),

    fixedRateDeviationMinLeftUnwindIMWad: toBn("0.04"),
    fixedRateDeviationMinRightUnwindIMWad: toBn("0.04"),

    gammaWad: toBn("5.0"),
    minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
  },
  lookBackWindowAPY: consts.ONE_DAY.mul(5),
  startingPrice: encodeSqrtRatioX96(1, 1),
  feeProtocol: 0,
  fee: toBn("0.003"),
  tickSpacing: TICK_SPACING,
  positions: [
    [0, -10980, 0], // LP: [1%, 3%]
    [1, -TICK_SPACING, TICK_SPACING], // VT
    [2, -TICK_SPACING, TICK_SPACING], // FT
  ],
  skipped: false,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  async getMargins(position: [string, number, number]) {
    const currentLiquidationThreshold =
      await this.marginEngineTest.callStatic.getPositionMarginRequirement(
        position[0],
        position[1],
        position[2],
        true
      );

    const currentMarginRequirement =
      await this.marginEngineTest.callStatic.getPositionMarginRequirement(
        position[0],
        position[1],
        position[2],
        false
      );

    return [
      utils.formatEther(currentLiquidationThreshold),
      utils.formatEther(currentMarginRequirement),
    ];
  }

  async writeEntry(day: number) {
    const p0 = await this.getMargins(this.positions[0]);
    const p1 = await this.getMargins(this.positions[1]);
    const p2 = await this.getMargins(this.positions[2]);

    const apy = await this.marginEngineTest.callStatic.getHistoricalApy();

    const fs = require("fs");
    fs.appendFileSync(
      "test/end_to_end/general_setup/alphaParamChecking/margins.csv",
      day.toString() +
        "," +
        utils.formatEther(apy) +
        "," +
        p0[1].toString() +
        "," +
        p0[0].toString() +
        "," +
        p1[1].toString() +
        "," +
        p1[0].toString() +
        "," +
        p2[1].toString() +
        "," +
        p2[0].toString() +
        "\n"
    );
  }

  override async run() {
    const fs = require("fs");
    fs.writeFileSync(
      "test/end_to_end/general_setup/alphaParamChecking/margins.csv",
      "day,apy,LPIM,LPLM,VTIM,VTLM,FTIM,FTLM\n"
    );

    await this.exportSnapshot("START");

    const apy = await this.marginEngineTest.callStatic.getHistoricalApy();
    console.log("starting apy...", utils.formatEther(apy));

    const NOTIONAL = toBn("10000");

    await this.e2eSetup.mintOrBurnViaPeriphery(this.positions[0][0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: this.positions[0][1],
      tickUpper: this.positions[0][2],
      notional: NOTIONAL,
      isMint: true,
      marginDelta: NOTIONAL,
    });

    {
      const swapParameters = {
        marginEngine: this.marginEngineTest.address,
        isFT: false,
        notional: NOTIONAL,
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        marginDelta: NOTIONAL,
      };
      await this.e2eSetup.swapViaPeriphery(
        this.positions[1][0],
        swapParameters
      );
    }

    {
      const swapParameters = {
        marginEngine: this.marginEngineTest.address,
        isFT: true,
        notional: NOTIONAL,
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
        marginDelta: NOTIONAL,
      };
      await this.e2eSetup.swapViaPeriphery(
        this.positions[2][0],
        swapParameters
      );
    }

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.increaseObservationCardinalityNext(2000);

    let acc = 1.008;
    const dailyLoading = 0.000047;
    const dailyCruise = 0.000047;
    for (let i = 0; i < 59; i++) {
      const daily = i < 5 ? dailyLoading : dailyCruise;
      await this.exportSnapshot("DAY " + i.toString());

      acc += daily / 4;
      await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc);

      acc += daily / 4;
      await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc);

      acc += daily / 4;
      await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc);

      acc += daily / 4;
      await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc);

      await this.writeEntry(i);
    }
  }
}

const test = async () => {
  console.log("alpha param checking");
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/alphaParamChecking/consoleViaPeriphery.txt"
  );
  await scenario.init();
  await scenario.run();
};

it("alpha param checking", test);
