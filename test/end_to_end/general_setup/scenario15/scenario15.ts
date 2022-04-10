import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { encodeSqrtRatioX96 } from "../../../shared/utilities";
import { e2eParameters } from "../e2eSetup";
import { ScenarioRunner } from "../general";

// const e2eParams: e2eParameters = {
//   duration: consts.ONE_MONTH,
//   numActors: 6,
//   marginCalculatorParams: {
//     apyUpperMultiplierWad: toBn("1.5"),
//     apyLowerMultiplierWad: toBn("0.7"),
//     sigmaSquaredWad: toBn("0.15"),
//     alphaWad: toBn("1.5"),
//     betaWad: toBn("1"),
//     xiUpperWad: toBn("2"),
//     xiLowerWad: toBn("1.5"),
//     tMaxWad: toBn("31536000"), // one year
//     devMulLeftUnwindLMWad: toBn("0.5"),
//     devMulRightUnwindLMWad: toBn("0.5"),
//     devMulLeftUnwindIMWad: toBn("0.8"),
//     devMulRightUnwindIMWad: toBn("0.8"),
//     fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
//     fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),
//     fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
//     fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),
//     gammaWad: toBn("1"),
//     minMarginToIncentiviseLiquidators: 0,
//   },
//   lookBackWindowAPY: consts.ONE_HOUR.mul(6),
//   startingPrice: encodeSqrtRatioX96(100, 338),
//   feeProtocol: 10,
//   fee: toBn("0.001"),
//   tickSpacing: 1000,
//   positions: [[0, -18000, -10000]],
//   skipped: false,
// };

let csvOutput = `alpha,beta,sigma,daysAhead,historicalApy,liqPMR,initPMR,initFT,initVT`;
let pastDays = 0;

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.marginEngineTest.setLookbackWindowInSeconds(
      this.params.lookBackWindowAPY
    );
    await this.marginEngineTest.setCacheMaxAgeInSeconds(consts.ONE_HOUR.mul(6));
    await this.marginEngineTest.setLiquidatorReward(toBn("0.1"));
    await this.marginEngineTest.setCacheMaxAgeInSeconds(consts.ONE_HOUR.mul(6));
    await this.marginEngineTest.setCacheMaxAgeInSeconds(consts.ONE_HOUR.mul(6));

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.setMinSecondsSinceLastUpdate(
      consts.ONE_HOUR.mul(6)
    );

    for (let i = 0; i < pastDays * 6; i++) {
      await this.advanceAndUpdateApy(
        consts.ONE_HOUR.mul(4),
        2,
        1 + (i + 1) / 36500 / 2
      );
    }

    csvOutput +=
      (
        parseFloat(
          utils.formatEther(
            await this.marginEngineTest.callStatic.getHistoricalApy()
          )
        ) * 100
      ).toFixed(2) +
      "%" +
      ",";

    await this.updateCurrentTick();
    // console.log("current tick:", this.currentTick);

    const p = this.positions[0];
    const positionMarginRequirement = await this.getMintInfoViaPeriphery(p[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: p[1],
      tickUpper: p[2],
      notional: toBn("100000"),
      isMint: true,
      marginDelta: toBn("0"),
    });

    await this.e2eSetup.mintOrBurnViaPeriphery(p[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: p[1],
      tickUpper: p[2],
      notional: toBn("100000"),
      isMint: true,
      marginDelta: toBn(positionMarginRequirement.toString()),
    });

    const liqPMR =
      await this.marginEngineTest.callStatic.getPositionMarginRequirement(
        p[0],
        p[1],
        p[2],
        true
      );

    const initPMR =
      await this.marginEngineTest.callStatic.getPositionMarginRequirement(
        p[0],
        p[1],
        p[2],
        false
      );

    csvOutput +=
      parseFloat(utils.formatEther(liqPMR)).toFixed(2) +
      "," +
      parseFloat(utils.formatEther(initPMR)).toFixed(2) +
      ",";

    const q = this.positions[1];
    const {
      marginRequirement: swapMarginRequirementFT,
      availableNotional: availableNotionalFT,
    } = await this.getInfoSwapViaPeriphery(q[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: q[1],
      tickUpper: q[2],
      notional: toBn("10000"),
      sqrtPriceLimitX96: BigNumber.from(encodeSqrtRatioX96(1, 1).toString()),
      isFT: true,
      marginDelta: toBn("0"),
    });

    console.log("availableNotional", availableNotionalFT);
    console.log(swapMarginRequirementFT);

    const {
      marginRequirement: swapMarginRequirementVT,
      availableNotional: availableNotionalVT,
    } = await this.getInfoSwapViaPeriphery(q[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: q[1],
      tickUpper: q[2],
      notional: toBn("10000"),
      sqrtPriceLimitX96: BigNumber.from(encodeSqrtRatioX96(1, 10).toString()),
      isFT: false,
      marginDelta: toBn("0"),
    });

    console.log("availableNotional", availableNotionalVT);
    console.log(swapMarginRequirementVT);

    csvOutput +=
      swapMarginRequirementFT.toFixed(2) +
      "," +
      swapMarginRequirementVT.toFixed(2);
  }
}

const alphas = [0.05, 0.5, 1.0, 1.5, 3];
const betas = [0.01, 0.1, 1, 5];
const sigmas = [0.01, 0.15, 0.3, 0.5, 1];

// const alphas = [1];
// const betas = [1];
// const sigmas = [0.15];

const test = async () => {
  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const sigma of sigmas) {
        for (let i = 2; i <= 2; i++) {
          pastDays = i;

          csvOutput +=
            "\n" +
            alpha.toString() +
            "," +
            beta.toString() +
            "," +
            sigma.toString() +
            ",";
          // console.log("alpha:", alpha, "beta:", beta, "sigma:", sigma);
          const e2eParamsNow: e2eParameters = {
            duration: consts.ONE_MONTH,
            numActors: 6,
            marginCalculatorParams: {
              apyUpperMultiplierWad: toBn("1.5"),
              apyLowerMultiplierWad: toBn("0.7"),
              sigmaSquaredWad: toBn(sigma.toString()),
              alphaWad: toBn(alpha.toString()),
              betaWad: toBn(beta.toString()),
              xiUpperWad: toBn("2"),
              xiLowerWad: toBn("1.5"),
              tMaxWad: toBn("31536000"), // one year
              devMulLeftUnwindLMWad: toBn("0.5"),
              devMulRightUnwindLMWad: toBn("0.5"),
              devMulLeftUnwindIMWad: toBn("0.8"),
              devMulRightUnwindIMWad: toBn("0.8"),
              fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
              fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),
              fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
              fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),
              gammaWad: toBn("1"),
              minMarginToIncentiviseLiquidators: 0,
            },
            lookBackWindowAPY: consts.ONE_HOUR.mul(6),
            startingPrice: encodeSqrtRatioX96(100, 338),
            feeProtocol: 10,
            fee: toBn("0.001"),
            tickSpacing: 1000,
            positions: [
              [0, -18000, -10000],
              [1, -18000, -10000],
            ],
            skipped: false,
          };

          csvOutput += (30 - pastDays).toString() + ",";

          const scenario = new ScenarioRunnerInstance(
            e2eParamsNow,
            "test/end_to_end/general_setup/scenario15/console.txt"
          );
          await scenario.init();
          await scenario.run();
        }
      }
    }
  }
  console.log(csvOutput);
  const fs = require("fs");
  fs.writeFileSync(
    "test/end_to_end/general_setup/scenario15/thresholdSwap.csv",
    csvOutput
  );
};

// const test = async () => {
//   console.log("scenario", 15);
//   const scenario = new ScenarioRunnerInstance(
//     e2eParams,
//     "test/end_to_end/general_setup/scenario15/console.txt"
//   );
//   await scenario.init();
//   await scenario.run();
// };

it("scenario 15", test);
