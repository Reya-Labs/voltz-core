import { BigNumber } from "ethers";
import { consts } from "../../../helpers/constants";
import {
  encodeSqrtRatioX96,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";
import { toBn } from "evm-bn";
import { expect } from "../../../shared/expect";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { testConfig } from "../../../../poolConfigs/pool-configs/testConfig";

// aDAI v2 pool configuration
const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(2),
  numActors: 2,
  marginCalculatorParams: testConfig.marginCalculatorParams,
  lookBackWindowAPY: BigNumber.from(testConfig.lookbackWindowInSeconds),
  startingPrice: encodeSqrtRatioX96(1, 1),
  feeProtocol: 0,
  fee: BigNumber.from(testConfig.feeWad),
  tickSpacing: testConfig.tickSpacing,
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

function tickFromFixedRate(fixedRate: number) {
  let tick = -Math.log(fixedRate) / Math.log(1.0001);
  tick = Math.floor((tick + 30) / 60) * 60;

  return tick;
}

describe.skip("Margin Requirements", () => {
  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2),
            tickFromFixedRate(0.5),
          ];

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(
            BigNumber.from("17694602615760930368")
          );
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
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2),
            tickFromFixedRate(0.5),
          ];

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(
            BigNumber.from("17694602615760930368")
          );
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "VT Initial Margin Requirement at start (worst APY = 0%, fixed rate = 1%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2),
            tickFromFixedRate(0.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);

          // advance rate such that rate between start and middle is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (30 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(BigNumber.from("8847168186811945412"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "VT Liquidation Margin Requirement at middle (worst APY = 0%, fixed rate = 1%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2),
            tickFromFixedRate(0.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);

          // advance rate such that rate between start and middle is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (30 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(BigNumber.from("8847168186811945412"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "VT Initial Margin Requirement at middle (worst APY = 0%, fixed rate = 1%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2),
            tickFromFixedRate(0.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(BigNumber.from("54770104008117700"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "VT Liquidation (Minimum) Margin Requirement at end (worst APY = 1.86%, fixed rate = 1%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 3).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(3.5),
            tickFromFixedRate(2.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(BigNumber.from("646678655306340336"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "VT Liquidation Margin Requirement at end (worst APY = 1.86%, fixed rate = 3%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2),
            tickFromFixedRate(0.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "VT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(BigNumber.from("487094496845971499"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "VT Initial Margin Requirement at end (worst APY = 0.186%, fixed rate = 1%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 4).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(4.5),
            tickFromFixedRate(3.5),
          ];

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(
            BigNumber.from("45582382967084076312")
          );
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Liquidation Margin Requirement at start (worst APY = 6.72%, fixed rate = 4%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 4).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(4.5),
            tickFromFixedRate(3.5),
          ];

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(
            BigNumber.from("156095984169886386312")
          );
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Initial Margin Requirement at start (worst APY = 13.44%, fixed rate = 4%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 4).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(4.5),
            tickFromFixedRate(3.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);

          // advance rate such that rate between start and middle is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (30 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(
            BigNumber.from("23642133644863506753")
          );
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Liquidation Margin Requirement at middle (worst_APY = 6.8%, fixed rate = 4%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 4).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(4.5),
            tickFromFixedRate(3.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);

          // advance rate such that rate between start and middle is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (30 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(
            BigNumber.from("79749387913250326753")
          );
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Initial Margin Requirement at middle (worst_APY = 13.62%, fixed rate = 4%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 4).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(4.5),
            tickFromFixedRate(3.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(BigNumber.from("54770104008117700"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Liquidation (Minimum) Margin Requirement at end (worst APY = 3.64%, fixed rate = 4%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 4).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(4.5),
            tickFromFixedRate(3.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(BigNumber.from("1843780802492142100"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Initial Margin Requirement at end (worst APY = 7.28%, fixed rate = 4%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 10).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(10.5),
            tickFromFixedRate(9.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(BigNumber.from("109540208016235400"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Initial (Minimum) Margin Requirement at end (worst APY = 7.28%, fixed rate = 10%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 2).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2.5),
            tickFromFixedRate(1.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              true
            );

          expect(requirement).to.be.near(BigNumber.from("935922498746892929"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Liquidation Margin Requirement at end (worst APY = 3.64%, fixed rate = 2%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 2).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2.5),
            tickFromFixedRate(1.5),
          ];

          await advanceTimeAndBlock(consts.ONE_MONTH, 1);
          await advanceTimeAndBlock(
            consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
            1
          );

          // advance rate such that rate between start and end is 3%
          const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
          await this.e2eSetup.setNewRate(middleRate);

          await this.openLPPosition(100000);
          await this.swapAgainstLP(10000, "FT");

          const p = this.positions[1];

          const requirement =
            await this.marginEngine.callStatic.getPositionMarginRequirement(
              p[0],
              p[1],
              p[2],
              false
            );

          expect(requirement).to.be.near(BigNumber.from("2939533504628372929"));
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "FT Initial Margin Requirement at end (worst APY = 7.28%, fixed rate = 2%)",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(2, 5).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2.5),
            tickFromFixedRate(1.5),
          ];

          await this.openLPPosition(100000);
          const p = this.positions[0];

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("317855142542049091684")
            );
          }

          {
            await advanceTimeAndBlock(consts.ONE_MONTH, 1);
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (30 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("158925149307332879061")
            );
          }

          {
            await advanceTimeAndBlock(
              consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
              1
            );
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (58 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("546191928323491932")
            );
          }
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "LP Liquidation (1.5% - 2.5%) where fixed rate is 2.5% -> VT side",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(2, 5).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2.5),
            tickFromFixedRate(1.5),
          ];

          await this.openLPPosition(100000);
          const p = this.positions[0];

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("317855142542049091684")
            );
          }

          {
            await advanceTimeAndBlock(consts.ONE_MONTH, 1);
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (30 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("158925149307332879061")
            );
          }

          {
            await advanceTimeAndBlock(
              consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
              1
            );
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (58 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("9580110576496208800")
            );
          }
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it("LP Initial (1.5% - 2.5%) where fixed rate is 2.5% -> VT side", test);
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(2, 3).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2.5),
            tickFromFixedRate(1.5),
          ];

          await this.openLPPosition(100000);
          const p = this.positions[0];

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("786158956438075365724")
            );
          }

          {
            await advanceTimeAndBlock(consts.ONE_MONTH, 1);
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (30 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("401611011526279919249")
            );
          }

          {
            await advanceTimeAndBlock(
              consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
              1
            );
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (58 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("9250885092649039122")
            );
          }
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it(
      "LP Liquidation (1.5% - 2.5%) where fixed rate is 1.5% -> FT side",
      test
    );
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(2, 3).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(2.5),
            tickFromFixedRate(1.5),
          ];

          await this.openLPPosition(100000);
          const p = this.positions[0];

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("1891306355508003965724")
            );
          }

          {
            await advanceTimeAndBlock(consts.ONE_MONTH, 1);
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (30 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("962713875303531619249")
            );
          }

          {
            await advanceTimeAndBlock(
              consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
              1
            );
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (58 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("29130279175156759960")
            );
          }
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it("LP Initial (1.5% - 2.5%) where fixed rate is 1.5% -> FT side", test);
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 5).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(975),
            tickFromFixedRate(950),
          ];

          await this.openLPPosition(100000);
          const p = this.positions[0];

          {
            await advanceTimeAndBlock(consts.ONE_MONTH, 1);
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (30 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("8218937087772704200")
            );
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("16437874175545408400")
            );
          }
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it("LP (950% - 975%) where fixed rate is 5% -> FT side", test);
  }

  {
    const test = async () => {
      class ScenarioRunnerInstance extends SpecificScenarioRunner {
        override async run() {
          await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 5).toString());
          this.positions[0] = [
            this.positions[0][0],
            tickFromFixedRate(0.005),
            tickFromFixedRate(0.002),
          ];

          await this.openLPPosition(100000);
          const p = this.positions[0];

          {
            await advanceTimeAndBlock(consts.ONE_MONTH, 1);
            // advance rate such that rate between start and end is 3%
            const middleRate = this.getRateInRay(
              1.01 * (1 + 0.03) ** (30 / 365)
            );
            await this.e2eSetup.setNewRate(middleRate);
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                true
              );

            expect(requirement).to.be.near(
              BigNumber.from("8218937087772704200")
            );
          }

          {
            const requirement =
              await this.marginEngine.callStatic.getPositionMarginRequirement(
                p[0],
                p[1],
                p[2],
                false
              );

            expect(requirement).to.be.near(
              BigNumber.from("16437874175545408400")
            );
          }
        }
      }

      const scenario = new ScenarioRunnerInstance(e2eParams);
      await scenario.init();
      await scenario.run();
    };

    it("LP (0.002% - 0.005%) where fixed rate is 5% -> FT side", test);
  }
});

describe("Unwinds", () => {
  const test = async () => {
    class ScenarioRunnerInstance extends SpecificScenarioRunner {
      override async run() {
        await this.vamm.initializeVAMM(encodeSqrtRatioX96(1, 3).toString());
        this.positions[0] = [
          this.positions[0][0],
          tickFromFixedRate(3.5),
          tickFromFixedRate(2.5),
        ];

        await advanceTimeAndBlock(consts.ONE_MONTH, 1);
        await advanceTimeAndBlock(
          consts.ONE_MONTH.sub(consts.ONE_DAY.mul(2)),
          1
        );

        // advance rate such that rate between start and end is 3%
        const middleRate = this.getRateInRay(1.01 * (1 + 0.03) ** (58 / 365));
        await this.e2eSetup.setNewRate(middleRate);

        await this.openLPPosition(100000);
        await this.swapAgainstLP(10000, "FT");

        const p = this.positions[1];

        // Set a ridiculously high minimum margin value, so that the FT position above becomes under water
        await this.marginEngine.setMarginCalculatorParameters({
          ...testConfig.marginCalculatorParams,
          etaIMWad: BigNumber.from(
            testConfig.marginCalculatorParams.etaIMWad
          ).mul(1000000000),
          etaLMWad: BigNumber.from(
            testConfig.marginCalculatorParams.etaLMWad
          ).mul(1000000000),
        });

        const positionInfoPreUnwind =
          await this.marginEngine.callStatic.getPosition(p[0], p[1], p[2]);
        const marginRequirementPreUnwind =
          await this.marginEngine.callStatic.getPositionMarginRequirement(
            p[0],
            p[1],
            p[2],
            true
          );
        expect(
          marginRequirementPreUnwind,
          "Expected an underwater position"
        ).to.be.gt(positionInfoPreUnwind.margin);

        // Swap with deliberately zero (= far too little) new margin provided
        // Verify that we can unwind the trade but not past zero into the opposite direction of trade
        const isFT = false;
        const swapParameters = {
          marginEngine: this.marginEngine.address,
          isFT: isFT,
          notional: toBn("0"),
          sqrtPriceLimitX96: isFT
            ? BigNumber.from(MAX_SQRT_RATIO.sub(1))
            : BigNumber.from(MIN_SQRT_RATIO.add(1)),
          tickLower: p[1],
          tickUpper: p[2],
          marginDelta: toBn("0"),
        };

        // Notionals larger than the current position size should fail
        for (const notional of [1000000000, 100000, 10001]) {
          swapParameters.notional = toBn(notional.toString());

          await expect(
            this.e2eSetup.swapViaPeriphery(p[0], swapParameters),
            `Expected to revert VT trade with notional ${notional} (not really an unwind)`
          ).to.be.reverted;
        }

        // Notional equal to the current position size should succeed
        swapParameters.notional = toBn("10000");
        await this.e2eSetup.swapViaPeriphery(p[0], swapParameters);

        const positionInfoPostUnwind =
          await this.marginEngine.callStatic.getPosition(p[0], p[1], p[2]);
        expect(
          positionInfoPostUnwind.variableTokenBalance,
          "Expect zero variable token balance after full unwind"
        ).to.be.eq(0);
      }
    }

    const scenario = new ScenarioRunnerInstance(e2eParams);
    await scenario.init();
    await scenario.run();
  };

  it(
    "Test that flipping under-collateralised position to the other direction is disallowed",
    test
  );
});
