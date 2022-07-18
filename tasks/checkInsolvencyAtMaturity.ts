import { task } from "hardhat/config";
import { FixedAndVariableMathTest, MarginEngine, BaseRateOracle } from "../typechain";
import { ethers, utils } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import { SECONDS_PER_YEAR } from "@aave/protocol-js";
import { toBn } from "../test/helpers/toBn";

import Decimal from "decimal.js-light";

task(
  "checkInsolvencyAtMaturity",
  "Checks the insolvency status of positions at maturity by estimating the expected cashflow."
).setAction(async (taskArgs, hre) => {
  // deploy FixedAndVariableMath as contract to be able to call function
  const fixedAndVariableMathFactory = await hre.ethers.getContractFactory(
    "FixedAndVariableMathTest"
  );
  const fixedAndVariableMath =
    (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMathTest;

  const marginEngineAddresses = new Set<string>();
  const positions: Position[] = await getPositions();
  for (const position of positions) {
    marginEngineAddresses.add(position.marginEngine);
  }

  console.log("Positions estimated to become insolvent at maturity:");
  console.log("(Owner, Lower Tick, Upper Tick, Current Margin, Estimated Cashflow Delta)");
  console.log("");

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
        termEndTimestampWad
      );

      // console.log(utils.formatEther(currentVariableFactor));

      const currentBlock = await hre.ethers.provider.getBlock("latest");
      // console.log(currentBlock.timestamp, Number(utils.formatEther(termStartTimestampWad)));
      const timeElapsed = currentBlock.timestamp - Number(utils.formatEther(termStartTimestampWad));
      const timeElapsedInYears = timeElapsed / SECONDS_PER_YEAR.toNumber();
      const estimatedAPY = new Decimal(utils.formatEther(currentVariableFactor))
        .add(1)
        .pow(1 / timeElapsedInYears)
        .sub(1);

      const timeOfPool = Number(utils.formatEther(termEndTimestampWad.sub(termStartTimestampWad)));
      const timeOfPoolInYears = timeOfPool / SECONDS_PER_YEAR.toNumber();
      const estimatedVariableFactor = toBn(Number(estimatedAPY.mul(timeOfPoolInYears)));

      // (1 + var) ^ 1/timeinyears - 1
      // APY x timesinyear

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
          ethers.utils.formatEther(estimatedCashflow)
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
