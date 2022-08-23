import { BigNumber } from "ethers";
import { consts } from "../../../helpers/constants";
import {
  encodeSqrtRatioX96,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { poolConfigs } from "../../../../deployConfig/poolConfig";
import { toBn } from "evm-bn";
import { expect } from "../../../shared/expect";

// aDAI v2 pool configuration
const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(2),
  numActors: 2,
  marginCalculatorParams: poolConfigs.aDAI.marginCalculatorParams,
  lookBackWindowAPY: BigNumber.from(poolConfigs.aDAI.lookbackWindowInSeconds),
  startingPrice: encodeSqrtRatioX96(1, 1),
  feeProtocol: 0,
  fee: BigNumber.from(poolConfigs.aDAI.feeWad),
  tickSpacing: poolConfigs.aDAI.tickSpacing,
  positions: [
    [0, 0, 0],
    [1, -60, 60],
  ],
  rateOracle: 1,
};

class SpecificScenarioRunner extends ScenarioRunner {
  async openLPPosition(notional: number) {
    const p = this.positions[0];

    const mintOrBurnParameters = {
      marginEngine: this.marginEngine.address,
      tickLower: p[1],
      tickUpper: p[2],
      notional: toBn(notional.toString()),
      isMint: true,
      marginDelta: toBn("0"),
    };

    const requirement = await this.getMintInfoViaPeriphery(
      p[0],
      mintOrBurnParameters
    );

    mintOrBurnParameters.marginDelta = toBn(requirement.toString());

    await this.e2eSetup.mintOrBurnViaPeriphery(p[0], mintOrBurnParameters);
  }

  async swapAgainstLP(notional: number, direction: string) {
    const p = this.positions[1];

    let isFT = true;
    switch (direction) {
      case "FT": {
        isFT = true;
        break;
      }
      case "VT": {
        isFT = false;
        break;
      }
      default: {
        throw new Error(`Unrecongized direction ${direction}.`);
      }
    }

    {
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: isFT,
        notional: toBn(notional.toString()),
        sqrtPriceLimitX96: isFT
          ? BigNumber.from(MAX_SQRT_RATIO.sub(1))
          : BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: p[1],
        tickUpper: p[2],
        marginDelta: toBn("0"),
      };

      const swapInfo = await this.getInfoSwapViaPeriphery(p[0], swapParameters);

      expect(swapInfo.availableNotional).to.be.eq(notional * (isFT ? -1 : 1));

      swapParameters.marginDelta = toBn(swapInfo.marginRequirement.toString());

      await this.e2eSetup.swapViaPeriphery(p[0], swapParameters);
    }
  }
}

describe("Margin Requirements", () => {
  const test = async () => {
    class ScenarioRunnerInstance extends SpecificScenarioRunner {
      override async run() {
        await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 5).toString());

        const fs = require("fs");
        const file = `test/end_to_end/general_setup/worstCaseApy/behaviour.csv`;

        const header = "middle_tick,safety_requirement";

        fs.writeFile(file, header + "\n", () => {});
        console.log(header);

        for (let i = -69060 + 120; i <= 69060 - 120; i += 120) {
          this.positions[0] = [this.positions[0][0], i - 60, i + 60];

          const mintOrBurnParameters = {
            marginEngine: this.marginEngine.address,
            tickLower: this.positions[0][1],
            tickUpper: this.positions[0][2],
            notional: toBn("10000"),
            isMint: true,
            marginDelta: toBn("0"),
          };

          const requirement = await this.getMintInfoViaPeriphery(
            this.positions[0][0],
            mintOrBurnParameters
          );

          console.log(i, requirement);
          fs.appendFileSync(file, `${i},${requirement}\n`);
        }
      }
    }

    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  it(
    "VT Liquidation Margin Requirement at start (worst APY = 0%, fixed rate = 1%)",
    test
  );
});
