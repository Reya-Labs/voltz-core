// import { BigNumber, constants } from "ethers";
// import { ethers } from "hardhat";
// import { expect } from "chai";
// import { SqrtPriceMathTest } from "../typechain/SqrtPriceMathTest";
// import { encodeSqrtRatioX96, expandTo18Decimals } from "./shared/utilities";

// describe("SqrtPriceMath", () => {
//   let sqrtPriceMath: SqrtPriceMathTest;

//   before(async () => {
//     const sqrtPriceMathTestFactory = await ethers.getContractFactory(
//       "SqrtPriceMathTest"
//     );
//     sqrtPriceMath =
//       (await sqrtPriceMathTestFactory.deploy()) as SqrtPriceMathTest;
//   });

//   describe("#getAmount0Delta", () => {
//     it("returns 0 if liquidity is 0", async () => {
//       const amount0 = await sqrtPriceMath.getAmount0Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(2, 1).toString(),
//         0,
//         true
//       );

//       expect(amount0).to.eq(0);
//     });

//     it("returns 0 if prices are equal", async () => {
//       const amount0 = await sqrtPriceMath.getAmount0Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(1, 1).toString(),
//         0,
//         true
//       );

//       expect(amount0).to.eq(0);
//     });

//     it("returns 0.1 amount1 for price of 1 to 1.21", async () => {
//       const amount0 = await sqrtPriceMath.getAmount0Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(121, 100).toString(),
//         expandTo18Decimals(1),
//         true
//       );

//       expect(amount0).to.eq("90909090909090910");

//       const amount0RoundedDown = await sqrtPriceMath.getAmount0Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(121, 100).toString(),
//         expandTo18Decimals(1),
//         false
//       );

//       expect(amount0RoundedDown).to.eq(amount0.sub(1));
//     });

//     it("works for prices that overflow", async () => {
//       const amount0Up = await sqrtPriceMath.getAmount0Delta(
//         encodeSqrtRatioX96(BigNumber.from(2).pow(90).toString(), 1).toString(),
//         encodeSqrtRatioX96(BigNumber.from(2).pow(96).toString(), 1).toString(),
//         expandTo18Decimals(1),
//         true
//       );
//       const amount0Down = await sqrtPriceMath.getAmount0Delta(
//         encodeSqrtRatioX96(BigNumber.from(2).pow(90).toString(), 1).toString(),
//         encodeSqrtRatioX96(BigNumber.from(2).pow(96).toString(), 1).toString(),
//         expandTo18Decimals(1),
//         false
//       );
//       expect(amount0Up).to.eq(amount0Down.add(1));
//     });
//   });

//   describe("#getAmount1Delta", () => {
//     it("returns 0 if liquidity is 0", async () => {
//       const amount1 = await sqrtPriceMath.getAmount1Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(2, 1).toString(),
//         0,
//         true
//       );

//       expect(amount1).to.eq(0);
//     });
//     it("returns 0 if prices are equal", async () => {
//       const amount1 = await sqrtPriceMath.getAmount1Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(1, 1).toString(),
//         0,
//         true
//       );

//       expect(amount1).to.eq(0);
//     });

//     it("returns 0.1 amount1 for price of 1 to 1.21", async () => {
//       const amount1 = await sqrtPriceMath.getAmount1Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(121, 100).toString(),
//         expandTo18Decimals(1),
//         true
//       );

//       expect(amount1).to.eq("100000000000000000");
//       const amount1RoundedDown = await sqrtPriceMath.getAmount1Delta(
//         encodeSqrtRatioX96(1, 1).toString(),
//         encodeSqrtRatioX96(121, 100).toString(),
//         expandTo18Decimals(1),
//         false
//       );

//       expect(amount1RoundedDown).to.eq(amount1.sub(1));
//     });
//   });
// });
