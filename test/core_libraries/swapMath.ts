import { expect } from "../shared/expect";
import { ethers, waffle } from "hardhat";
// import snapshotGasCost from "../shared/snapshotGasCost";
import { SwapMathTest } from "../../typechain/SwapMathTest";
// import { Wallet } from "ethers";
// import { createFixtureLoader } from "ethereum-waffle";
// import { SqrtPriceMathTest } from "../../typechain/SqrtPriceMathTest";
import { toBn } from "evm-bn";
import { encodePriceSqrt, expandTo18Decimals } from "../shared/utilities";

const { BigNumber } = ethers;

describe("SwapMath", () => {
  // let wallet: Wallet, other: Wallet;
  let swapMath: SwapMathTest;

  // let loadFixture: ReturnType<typeof createFixtureLoader>;

  // before("create fixture loader", async () => {
  // [wallet, other] = await (ethers as any).getSigners();
  // loadFixture = createFixtureLoader([wallet, other]);
  // });

  const fixtureSwapMath = async () => {
    const factory = await ethers.getContractFactory("SwapMathTest");
    return (await factory.deploy()) as SwapMathTest;
  };

  // const fixtureSqrtPriceMath = async () => {
  //   const factory = await ethers.getContractFactory("SqrtPriceMathTest");
  //   return (await factory.deploy()) as SqrtPriceMathTest;
  // };

  beforeEach("deploy SwapMathTest", async () => {
    swapMath = await waffle.loadFixture(fixtureSwapMath);
    // sqrtPriceMath = await waffle.loadFixture(fixtureSqrtPriceMath);
  });

  describe("#computeFeeAmount", () => {
    it("computeFeeAmount", async () => {
      expect(
        await swapMath.computeFeeAmount(
          toBn("1000"),
          toBn("31536000"),
          toBn("0.3")
        )
      ).to.eq(300);
    });

    it("no notional", async () => {
      expect(
        await swapMath.computeFeeAmount(
          toBn("0"),
          toBn("31536000"),
          toBn("0.3")
        )
      ).to.eq(0);
    });

    it("no time until maturity", async () => {
      expect(
        await swapMath.computeFeeAmount(toBn("1000"), toBn("0"), toBn("0.3"))
      ).to.eq(0);
    });

    it("no percentage fee", async () => {
      expect(
        await swapMath.computeFeeAmount(toBn("0"), toBn("31536000"), toBn("0"))
      ).to.eq(0);
    });

    it("overflow if notional >= 10**60", async () => {
      await expect(
        swapMath.computeFeeAmount(
          toBn("1" + "0".repeat(59)),
          toBn("31536000"),
          toBn("1")
        )
      ).to.not.be.reverted;
      // expect(
      //   async () =>
      //     await swapMath.computeFeeAmount(
      //       toBn("1" + "0".repeat(60)),
      //       toBn("31536000"),
      //       toBn("1")
      //     )
      // ).to.throw;
    });
  });

  describe("#computeSwapStep", () => {
    it("exact amount in that gets capped at price target in one for zero", async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = toBn("2");
      const amount = toBn("1");
      const fee = toBn("0.3");
      // const zeroForOne = false;
      const timeToMaturityInSeconds = toBn("31536000");

      const { amountIn, amountOut, sqrtQ, feeAmount } =
        await swapMath.computeSwapStep(
          price,
          priceTarget,
          liquidity,
          amount,
          fee,
          timeToMaturityInSeconds
        );

      expect(amountIn).to.eq("9975124224178055");
      expect(feeAmount).to.eq("2992537267253416");
      expect(amountOut).to.eq("9925619580021728");
      expect(sqrtQ, "price is capped at price target").to.eq(priceTarget);
    });

    it("exact amount out that gets capped at price target in one for zero", async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(101, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1).mul(-1);
      const fee = toBn("0.3");
      // const zeroForOne = false;
      const timeToMaturityInSeconds = toBn("31536000");

      const { amountIn, amountOut, sqrtQ, feeAmount } =
        await swapMath.computeSwapStep(
          price,
          priceTarget,
          liquidity,
          amount,
          fee,
          timeToMaturityInSeconds
        );

      expect(amountIn).to.eq("9975124224178055");
      expect(feeAmount).to.eq("2992537267253416");
      expect(amountOut).to.eq("9925619580021728");
      expect(amountOut, "entire amount out is not returned").to.lt(
        amount.mul(-1)
      );

      expect(sqrtQ, "price is capped at price target").to.eq(priceTarget);
    });

    it("exact amount in that is fully spent in one for zero", async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(1000, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1);
      const fee = toBn("0.3");
      const timeToMaturityInSeconds = toBn("31536000");

      // nextPrice = 1 + 1/2
      // amountIn = liquidity (nextPrice - price) = 1
      // amountOut = liquidity (nextPrice - price) / (nextPrice * price) = 2/3
      // fee = 1 * 0.3 = 0.3

      const { amountIn, amountOut, sqrtQ, feeAmount } =
        await swapMath.computeSwapStep(
          price,
          priceTarget,
          liquidity,
          amount,
          fee,
          timeToMaturityInSeconds
        );

      expect(amountIn).to.eq(toBn("1"));
      expect(feeAmount).to.eq(toBn("0.3"));
      expect(amountOut).to.eq("6".repeat(18));
      expect(sqrtQ).to.eq(encodePriceSqrt(9, 4));
      expect(sqrtQ, "price does not reach price target").to.be.lt(priceTarget);
    });

    it("exact amount out that is fully received in one for zero", async () => {
      const price = encodePriceSqrt(1, 1);
      const priceTarget = encodePriceSqrt(10000, 100);
      const liquidity = expandTo18Decimals(2);
      const amount = expandTo18Decimals(1).mul(-1);
      const fee = toBn("0.3");
      const timeToMaturityInSeconds = toBn("31536000");

      // nextPrice = 2
      // amountIn = liquidity (nextPrice - price) = 2
      // amountOut = liquidity (nextPrice - price) / (nextPrice * price) = 1
      // feeAmount = 2 * 0.3 = 0.6

      const { amountIn, amountOut, sqrtQ, feeAmount } =
        await swapMath.computeSwapStep(
          price,
          priceTarget,
          liquidity,
          amount,
          fee,
          timeToMaturityInSeconds
        );

      expect(amountIn).to.eq(toBn("2"));
      expect(feeAmount).to.eq(toBn("0.6"));
      expect(amountOut).to.eq(toBn("1"));
      expect(sqrtQ).to.eq(encodePriceSqrt(4, 1));
      expect(sqrtQ, "price does not reach price target").to.be.lt(priceTarget);
    });

    it("amount out is capped at the desired amount out", async () => {
      const price = BigNumber.from("417332158212080721273783715441582");
      const priceTarget = BigNumber.from("1452870262520218020823638996");
      const liquidity = "159344665391607089467575320103";
      const amount = expandTo18Decimals(1).mul(-1);
      const fee = toBn("0.3");
      const timeToMaturityInSeconds = toBn("31536000");

      const { amountIn, amountOut, sqrtQ, feeAmount } =
        await swapMath.computeSwapStep(
          price,
          priceTarget,
          liquidity,
          amount,
          fee,
          timeToMaturityInSeconds
        );

      // newPrice = price - 1/liquidity
      // amountIn = 1 / (P * newPrice)
      // amountOut = 1

      expect(sqrtQ).to.eq("417332158212080224061264428696775");
      expect(amountIn).to.eq("36040886511");
      expect(amountOut).to.eq(toBn("1"));
      expect(feeAmount).to.eq("300000000000000000");
    });

    it("target price of 1 uses partial input amount", async () => {
      const price = encodePriceSqrt(4, 1);
      const priceTarget = encodePriceSqrt(1, 1);
      const liquidity = expandTo18Decimals(1);
      const amount = "3915081100057732413702495386755767";
      const fee = toBn("0.3");
      const timeToMaturityInSeconds = toBn("31536000");
      const { amountIn, amountOut, sqrtQ, feeAmount } =
        await swapMath.computeSwapStep(
          price,
          priceTarget,
          liquidity,
          amount,
          fee,
          timeToMaturityInSeconds
        );

      expect(sqrtQ, "sqrtQ").to.eq(encodePriceSqrt(1, 1));
      expect(amountIn, "amount in").to.eq(toBn("0.5"));
      expect(amountOut, "amount out").to.eq(toBn("1"));
      expect(feeAmount, "fee amount").to.eq(toBn("0.3"));
    });
  });
});
