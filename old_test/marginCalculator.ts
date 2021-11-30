import { Wallet, BigNumber } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MarginCalculator } from "../typechain/MarginCalculator";
import { toBn } from "evm-bn";
import { div, sub, mul } from "./shared/functions";
import { encodeSqrtRatioX96, expandTo18Decimals } from "./shared/utilities";

import { MarginCalculatorTest } from "../typechain/MarginCalculatorTest";

const createFixtureLoader = waffle.createFixtureLoader;

describe("Margin Calculator", () => {
  let wallet: Wallet, other: Wallet;
  let calculator: MarginCalculator;

  let calculatorTest: MarginCalculatorTest;

  const fixture = async () => {
    const marginCalculator = await ethers.getContractFactory(
      "MarginCalculator"
    );
    return (await marginCalculator.deploy()) as MarginCalculator;
  };

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);

    const calculatorTestFactory = await ethers.getContractFactory(
      "MarginCalculatorTest"
    );
    calculatorTest =
      (await calculatorTestFactory.deploy()) as MarginCalculatorTest;
  });

  beforeEach("deploy calculator", async () => {
    calculator = await loadFixture(fixture);
  });

  describe("#accrual factor is correctly calculated", async () => {
    const testSets = [
      [toBn("4"), toBn("31536000")],
      [toBn("50"), toBn("31536000")],
      [toBn("34536000"), toBn("31536000")],
      [toBn("34537000"), toBn("31536000")],
    ];

    testSets.forEach((testSet) => {
      const x: BigNumber = testSet[0];
      const y: BigNumber = testSet[1];

      it(`takes ${x} and ${y} and returns the correct value`, async () => {
        const expected: BigNumber = div(x, y);
        expect(await calculator.accrualFact(x)).to.eq(expected);
      });
    });
  });

  describe("#lp margin computation works correclty", async () => {
    it("correctly computes maxiumum notional within a tick range", async () => {
      // const amount0 = "0.09090909090909091"
      // const amount1 = "0.1"

      const { 0: notional, 1: fixedRate } =
        await calculatorTest.tickRangeNotionalFixedRate(
          encodeSqrtRatioX96(1, 1).toString(),
          encodeSqrtRatioX96(121, 100).toString(),
          expandTo18Decimals(1)
        );

      expect(notional).to.eq(BigNumber.from("100000000000000000"));
    });

    it("correctly computes fixed rate within a tick range", async () => {
      const amount0 = toBn("0.09090909090909091");
      const amount1 = toBn("0.1");

      const { 0: notional, 1: fixedRate } =
        await calculatorTest.tickRangeNotionalFixedRate(
          encodeSqrtRatioX96(1, 1).toString(),
          encodeSqrtRatioX96(121, 100).toString(),
          expandTo18Decimals(1)
        );

      const expectedFixedRate = mul(div(amount0, amount1), toBn("0.01"));

      expect(fixedRate).to.eq(expectedFixedRate);
    });

    it("correctly computes LP margin requirement when price insude the current tick range", async () => {
      // todo:
    });
  });

  describe("#ft margin computation works correclty", async () => {
    // uint256 notional, uint256 fixedRate, uint256 timeInSeconds

    // is liquidation margin

    // uint256 public apyUpper = 9 * 10**16; // 0.09, 9%
    // uint256 public apyLower = 1 * 10**16; // 0.01, 1%;

    // uint256 public apyUpperMultiplier = 2 * 10**18; // 2.0
    // uint256 public apyLowerMultiplier = 5 * 10**17; // 0.5

    // uint256 public minDeltaLM = 125 * 10**14; // 0.0125
    // uint256 public minDeltaIM = 500 * 10**14; // 0.05

    const testSets = [[toBn("4000"), toBn("0.04"), toBn("50000")]];

    testSets.forEach((testSet) => {
      const notional: BigNumber = testSet[0];
      const fixedRate: BigNumber = testSet[1];
      const timeInSeconds: BigNumber = testSet[2];

      it(`takes notional of ${notional}, fixedRate of ${fixedRate} and timeInSeconds of ${timeInSeconds}`, async () => {
        const apyUpper = toBn("0.09");
        const minDeltaLM = toBn("0.0125");
        let rateDelta: BigNumber = sub(apyUpper, fixedRate);
        rateDelta = rateDelta > minDeltaLM ? rateDelta : minDeltaLM;

        const accrualFactor = div(timeInSeconds, toBn("31536000"));

        const margin = mul(mul(notional, rateDelta), accrualFactor);

        expect(
          await calculator.getFTMarginRequirement(
            notional,
            fixedRate,
            timeInSeconds,
            true
          )
        ).to.eq(margin);
      });
    });
  });

  describe("#vt margin computation works correclty", async () => {
    // uint256 notional, uint256 fixedRate, uint256 timeInSeconds

    // is liquidation margin

    // uint256 public apyUpper = 9 * 10**16; // 0.09, 9%
    // uint256 public apyLower = 1 * 10**16; // 0.01, 1%;

    // uint256 public apyUpperMultiplier = 2 * 10**18; // 2.0
    // uint256 public apyLowerMultiplier = 5 * 10**17; // 0.5

    // uint256 public minDeltaLM = 125 * 10**14; // 0.0125
    // uint256 public minDeltaIM = 500 * 10**14; // 0.05

    // Error: VM Exception while processing transaction: reverted with custom error 'PRBMathUD60x18__SubUnderflow(40000000000000000, 500000000000000000)'

    const testSets = [[toBn("4000"), toBn("0.04"), toBn("50000")]];

    testSets.forEach((testSet) => {
      const notional: BigNumber = testSet[0];
      const fixedRate: BigNumber = testSet[1];
      const timeInSeconds: BigNumber = testSet[2];

      it(`takes notional of ${notional}, fixedRate of ${fixedRate} and timeInSeconds of ${timeInSeconds}`, async () => {
        const apyLower = toBn("0.01");
        const minDeltaLM = toBn("0.0125");
        let rateDelta: BigNumber = sub(fixedRate, apyLower);
        rateDelta = rateDelta > minDeltaLM ? rateDelta : minDeltaLM;

        const accrualFactor = div(timeInSeconds, toBn("31536000"));

        const margin = mul(mul(notional, rateDelta), accrualFactor);

        expect(
          await calculator.getVTMarginRequirement(
            notional,
            fixedRate,
            timeInSeconds,
            true
          )
        ).to.eq(margin);
      });
    });
  });
});
