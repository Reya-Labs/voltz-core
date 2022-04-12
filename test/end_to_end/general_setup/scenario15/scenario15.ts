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

let csvOutput = `alpha,beta,sigma,daysAhead,historicalApy,lowerBoundApy,upperBoundApy,liqPMR,initPMR,initFT,initVT`;
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
        1 + (i + 1) / 3650 / 20
      );
    }

    await this.updateAPYbounds();

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

    csvOutput +=
      (parseFloat(utils.formatEther(this.lowerApyBound)) * 100).toFixed(2) +
      "%" +
      ",";

    csvOutput +=
      (parseFloat(utils.formatEther(this.upperApyBound)) * 100).toFixed(2) +
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

    console.log("liqPMR:", parseFloat(utils.formatEther(liqPMR)).toFixed(2));
    console.log("initPMR:", parseFloat(utils.formatEther(initPMR)).toFixed(2));

    const q = this.positions[1];
    const {
      marginRequirement: swapMarginRequirementAux,
      availableNotional: availableNotionalAux,
    } = await this.getInfoSwapViaPeriphery(q[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: q[1],
      tickUpper: q[2],
      notional: toBn("100000"),
      sqrtPriceLimitX96: await this.testTickMath.getSqrtRatioAtTick(p[2]),
      isFT: true,
      marginDelta: toBn("0"),
    });

    console.log("availableNotional", availableNotionalAux);
    console.log(swapMarginRequirementAux);

    await this.e2eSetup.swapViaPeriphery(q[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: q[1],
      tickUpper: q[2],
      notional: toBn("100000"),
      sqrtPriceLimitX96: await this.testTickMath.getSqrtRatioAtTick(p[2]),
      isFT: true,
      marginDelta: toBn(swapMarginRequirementAux.toString()),
    });

    await this.updateCurrentTick();
    console.log(this.currentTick);

    const r = this.positions[2];
    const {
      marginRequirement: swapMarginRequirementVT,
      availableNotional: availableNotionalVT,
    } = await this.getInfoSwapViaPeriphery(r[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: r[1],
      tickUpper: r[2],
      notional: toBn("100000"),
      sqrtPriceLimitX96: await this.testTickMath.getSqrtRatioAtTick(p[1]),
      isFT: false,
      marginDelta: toBn("0"),
    });

    console.log("availableNotional", availableNotionalVT);
    console.log(swapMarginRequirementVT);

    await this.e2eSetup.swapViaPeriphery(r[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: r[1],
      tickUpper: r[2],
      notional: toBn("100000"),
      sqrtPriceLimitX96: await this.testTickMath.getSqrtRatioAtTick(p[1]),
      isFT: false,
      marginDelta: toBn(swapMarginRequirementVT.toString()),
    });

    await this.updateCurrentTick();
    console.log(this.currentTick);

    const s = this.positions[3];
    const {
      marginRequirement: swapMarginRequirementFT,
      availableNotional: availableNotionalFT,
    } = await this.getInfoSwapViaPeriphery(s[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: s[1],
      tickUpper: s[2],
      notional: toBn("100000"),
      sqrtPriceLimitX96: await this.testTickMath.getSqrtRatioAtTick(p[2]),
      isFT: true,
      marginDelta: toBn("0"),
    });

    console.log("availableNotional", availableNotionalFT);
    console.log(swapMarginRequirementFT);

    await this.e2eSetup.swapViaPeriphery(s[0], {
      marginEngine: this.marginEngineTest.address,
      tickLower: s[1],
      tickUpper: s[2],
      notional: toBn("100000"),
      sqrtPriceLimitX96: await this.testTickMath.getSqrtRatioAtTick(p[2]),
      isFT: true,
      marginDelta: toBn(swapMarginRequirementFT.toString()),
    });

    await this.updateCurrentTick();
    console.log(this.currentTick);

    csvOutput +=
      swapMarginRequirementFT.toFixed(2) +
      "," +
      swapMarginRequirementVT.toFixed(2);
  }
}

// const alphas = [0.05, 0.5, 1.0, 1.5, 3];
// const betas = [0.01, 0.1, 1, 5];
// const sigmas = [0.01, 0.15, 0.3, 0.5, 1];

const alphas = [0.5];
const betas = [0.1];
const sigmas = [1];

// const alphas = [0.035];
// const betas = [0.046];
// const sigmas = [0.055];

const test = async () => {
  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const sigma of sigmas) {
        for (let i = 2; i <= 2; i += 1) {
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
              devMulLeftUnwindIMWad: toBn("1.5"),
              devMulRightUnwindIMWad: toBn("1.5"),
              fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
              fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),
              fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
              fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),
              gammaWad: toBn("1"),
              minMarginToIncentiviseLiquidators: 0,
            },
            lookBackWindowAPY: consts.ONE_HOUR.mul(6),
            startingPrice: encodeSqrtRatioX96(100, 316),
            feeProtocol: 10,
            fee: toBn("0.001"),
            tickSpacing: 1000,
            positions: [
              // [0, -18000, -10000],
              // [0, -32000, -25000],
              // [0, -46000, -45000],
              // [0, 50000, 60000],
              // [0, -60000, -50000],
              [0, -18000, -10000],
              [1, -18000, -10000],
              [2, -18000, -10000],
              [3, -18000, -10000],
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
    "test/end_to_end/general_setup/scenario15/thresholdFromCalibration.csv",
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
