import { task } from "hardhat/config";
import {
  FixedAndVariableMathTest,
  MarginEngine,
  BaseRateOracle,
} from "../typechain";
import { ethers, utils, BigNumber } from "ethers";

import { SECONDS_PER_YEAR } from "@aave/protocol-js";
import { toBn } from "../test/helpers/toBn";

import * as poolAddresses from "../pool-addresses/mainnet.json";

import Decimal from "decimal.js-light";
import { getPositions, Position } from "../scripts/getPositions";

task(
  "checkInsolvencyAtMaturity",
  "Checks the insolvency status of positions at maturity by estimating the expected cashflow."
).setAction(async (taskArgs, hre) => {
  const fixedAndVariableMath = (await hre.ethers.getContractAt(
    "FixedAndVariableMathTest",
    "0x2D2EE238Ca74B546BfA64864f5654b5Ed7673f87"
  )) as FixedAndVariableMathTest;

  const positions: Position[] = await getPositions();

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
  for (const poolName in poolAddresses) {
    if (poolName === "default") {
      continue;
    }

    const marginEngineAddress = poolAddresses[poolName as keyof typeof poolAddresses].marginEngine;

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      marginEngineAddress
    )) as MarginEngine;

    const baseRateOracle = (await hre.ethers.getContractAt(
      "BaseRateOracle",
      await marginEngine.rateOracle()
    )) as BaseRateOracle;

    for (const position of positions) {
      if (position.marginEngine !== marginEngineAddress) {
        continue;
      }

      const positionInfo = await marginEngine.callStatic.getPosition(
        position.owner,
        position.tickLower,
        position.tickUpper
      );

      const termStartTimestampWad = await marginEngine.termStartTimestampWad();
      const termEndTimestampWad = await marginEngine.termEndTimestampWad();

      const currentVariableFactor = await baseRateOracle.variableFactorNoCache(
        termStartTimestampWad,
        termCurrentTimestampWad
      );

      const timeElapsed =
        currentBlock.timestamp -
        Number(utils.formatEther(termStartTimestampWad));
      const timeElapsedInYears = timeElapsed / SECONDS_PER_YEAR.toNumber();
      const estimatedAPY = new Decimal(utils.formatEther(currentVariableFactor))
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

        noneInsolvent = false;
      }
    }
  }

  if (noneInsolvent) {
    console.log("None. :-)");
  }
});

module.exports = {};
