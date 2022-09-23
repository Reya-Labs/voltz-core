import { task } from "hardhat/config";
import {
  FixedAndVariableMathTest,
  MarginEngine,
  BaseRateOracle,
  IERC20Minimal,
} from "../typechain";
import { ethers, utils, BigNumber } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import { SECONDS_PER_YEAR } from "@aave/protocol-js";
import { toBn } from "../test/helpers/toBn";

import Decimal from "decimal.js-light";

const tokenNameToTopupBuffer = {
  USDC: BigNumber.from(10).pow(4),
  DAI: BigNumber.from(10).pow(16),
  USDT: BigNumber.from(10).pow(4),
  ETH: BigNumber.from(10).pow(13),
};

task(
  "checkInsolvencyAtMaturity",
  "Checks the insolvency status of positions at maturity by estimating the expected cashflow."
)
  .addFlag(
    "topupUnwoundInsolventPositions",
    "Tops up insolvent positions which are unwound"
  )
  .setAction(async (taskArgs, hre) => {
    const fixedAndVariableMathAddress =
      "0x2D2EE238Ca74B546BfA64864f5654b5Ed7673f87";
    const fixedAndVariableMath = (await hre.ethers.getContractAt(
      "FixedAndVariableMathTest",
      fixedAndVariableMathAddress
    )) as FixedAndVariableMathTest;

    // deploy FixedAndVariableMath as contract to be able to call function
    // const fixedAndVariableMathFactory = await hre.ethers.getContractFactory(
    //   "FixedAndVariableMathTest"
    // );
    // const fixedAndVariableMath =
    //   (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMathTest;

    const marginEngineAddresses = new Set<string>();
    const positions: Position[] = await getPositions(true);
    for (const position of positions) {
      marginEngineAddresses.add(position.marginEngine);
    }

    console.log("Positions estimated to become insolvent at maturity:");
    console.log(
      "(Owner, Lower Tick, Upper Tick, Current Margin, Estimated Cashflow Delta, Estimated Total Cashflow)"
    );
    console.log("");

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const termCurrentTimestampWad = BigNumber.from(currentBlock.timestamp).mul(
      BigNumber.from(10).pow(18)
    );

    let noneInsolvent = true;
    for (const marginEngineAddress of marginEngineAddresses) {
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
      )) as MarginEngine;

      const baseRateOracle = (await hre.ethers.getContractAt(
        "BaseRateOracle",
        await marginEngine.rateOracle()
      )) as BaseRateOracle;

      const underlyingTokenAddress = await (
        await marginEngine.underlyingToken()
      ).toLowerCase();
      const underlyingTokenName = getUnderlyingTokenName(
        underlyingTokenAddress
      );
      const underlyingToken = (await hre.ethers.getContractAt(
        "IERC20Minimal",
        await marginEngine.underlyingToken()
      )) as IERC20Minimal;

      for (const position of positions) {
        if (position.marginEngine !== marginEngineAddress) {
          continue;
        }

        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        const termStartTimestampWad =
          await marginEngine.termStartTimestampWad();
        const termEndTimestampWad = await marginEngine.termEndTimestampWad();

        const currentVariableFactor =
          await baseRateOracle.variableFactorNoCache(
            termStartTimestampWad,
            termCurrentTimestampWad
          );

        const timeElapsed =
          currentBlock.timestamp -
          Number(utils.formatEther(termStartTimestampWad));
        const timeElapsedInYears = timeElapsed / SECONDS_PER_YEAR.toNumber();
        const estimatedAPY = new Decimal(
          utils.formatEther(currentVariableFactor)
        )
          .add(1)
          .pow(1 / timeElapsedInYears)
          .sub(1);

        const timeOfPool = Number(
          utils.formatEther(termEndTimestampWad.sub(termStartTimestampWad))
        );
        const timeOfPoolInYears = timeOfPool / SECONDS_PER_YEAR.toNumber();
        const estimatedVariableFactor = toBn(
          Number(estimatedAPY.mul(timeOfPoolInYears))
        );

        const estimatedCashflow =
          await fixedAndVariableMath.calculateSettlementCashflow(
            positionInfo.fixedTokenBalance,
            positionInfo.variableTokenBalance,
            termStartTimestampWad,
            termEndTimestampWad,
            estimatedVariableFactor
          );

        // console.log(utils.formatEther(positionInfo.margin.add(estimatedCashflow)));
        if (positionInfo.margin.add(estimatedCashflow).lt(0)) {
          console.log(
            position.owner,
            position.tickLower,
            position.tickUpper,
            ethers.utils.formatEther(positionInfo.margin),
            ethers.utils.formatEther(estimatedCashflow),
            ethers.utils.formatEther(positionInfo.margin.add(estimatedCashflow))
          );

          if (
            taskArgs.topupUnwoundInsolventPositions &&
            positionInfo.variableTokenBalance.eq(0)
          ) {
            let topupBufferInUnderlyingTokenPrecision = BigNumber.from(0);
            switch (underlyingTokenName) {
              case "USDC": {
                topupBufferInUnderlyingTokenPrecision =
                  tokenNameToTopupBuffer.USDC;
                break;
              }

              case "DAI": {
                topupBufferInUnderlyingTokenPrecision =
                  tokenNameToTopupBuffer.DAI;
                break;
              }

              case "USDT": {
                topupBufferInUnderlyingTokenPrecision =
                  tokenNameToTopupBuffer.USDT;
                break;
              }

              case "ETH": {
                topupBufferInUnderlyingTokenPrecision =
                  tokenNameToTopupBuffer.ETH;
                break;
              }

              default: {
                topupBufferInUnderlyingTokenPrecision = BigNumber.from(0);
                break;
              }
            }

            const topupAmount = positionInfo.margin
              .add(estimatedCashflow)
              .mul(-1)
              .add(topupBufferInUnderlyingTokenPrecision);

            console.log(utils.formatEther(topupAmount));

            // {
            //   const tx = await underlyingToken.approve(
            //     marginEngineAddress,
            //     BigNumber.from(10).pow(27)
            //   );

            //   await tx.wait();
            // }

            // {
            //   const tx = await marginEngine.updatePositionMargin(
            //     position.owner,
            //     position.tickLower,
            //     position.tickUpper,
            //     topupAmount,
            //     {
            //       gasLimit: 10000000,
            //     }
            //   );

            //   await tx.wait();
            // }

            // console.log(
            //   "Insolvent position topped up successfully. Top up amount: ",
            //   topupAmount
            // );
          }

          noneInsolvent = false;
        }
      }
    }

    if (noneInsolvent) {
      console.log("None. :-)");
    }
  });

const getUnderlyingTokenName = (address: string): string => {
  // mainnet
  if (
    address
      .toLowerCase()
      .includes("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48".toLowerCase())
  ) {
    return "USDC";
  }

  // goerli
  if (
    address
      .toLowerCase()
      .includes("0xD87Ba7A50B2E7E660f678A895E4B72E7CB4CCd9C".toLowerCase())
  ) {
    return "USDC";
  }

  // goerli
  if (
    address
      .toLowerCase()
      .includes("0x2f3a40a3db8a7e3d09b0adfefbce4f6f81927557".toLowerCase())
  ) {
    return "USDC";
  }

  // mainnet
  if (
    address
      .toLowerCase()
      .includes("0x6b175474e89094c44da98b954eedeac495271d0f".toLowerCase())
  ) {
    return "DAI";
  }

  // goerli
  if (
    address
      .toLowerCase()
      .includes("0x73967c6a0904aa032c103b4104747e88c566b1a2".toLowerCase())
  ) {
    return "DAI";
  }

  // mainnet
  if (
    address
      .toLowerCase()
      .includes("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase())
  ) {
    return "ETH";
  }

  // goerli
  if (
    address
      .toLowerCase()
      .includes("0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6".toLowerCase())
  ) {
    return "ETH";
  }

  // mainnet
  if (
    address
      .toLowerCase()
      .includes("0xdAC17F958D2ee523a2206206994597C13D831ec7".toLowerCase())
  ) {
    return "USDT";
  }

  return "UNKNOWN";
};

module.exports = {};
