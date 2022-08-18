import { task, types } from "hardhat/config";
import { BaseRateOracle, MarginEngine } from "../typechain";
import { ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { getSwaps, Swap } from "../scripts/getSwaps";
import { number } from "mathjs";
import { toBn } from "evm-bn";

task("checkPositionSettlement", "Check positions")
  .addParam(
    "owner",
    "Owner of position",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .addParam(
    "tickLower",
    "Tick lower of position",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .addParam(
    "tickUpper",
    "Tick upper of position",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .addParam(
    "marginEngineAddress",
    "The margin engine associated with the position",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    const swaps: Swap[] = await getSwaps(
      taskArgs.owner,
      taskArgs.tickLower,
      taskArgs.tickUpper,
      taskArgs.marginEngineAddress
    );

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as MarginEngine;

    const rateOracle = (await hre.ethers.getContractAt(
      "BaseRateOracle",
      await marginEngine.rateOracle()
    )) as BaseRateOracle;

    const timeEnd = number(
      ethers.utils.formatEther(await marginEngine.termEndTimestampWad())
    );

    let overallSettlementCashflow = 0;
    for (const swap of swaps) {
      const timeSwap = number(swap.createdTimestamp);
      const sign = number(swap.variableTokenDelta) < 0 ? 1 : -1;

      const notional = Math.abs(
        Number(ethers.utils.formatEther(swap.variableTokenDelta))
      );

      const fixedRate =
        Math.abs(
          Number(ethers.utils.formatEther(swap.fixedTokenDeltaUnbalanced))
        ) / notional;

      let swapSettlementCashflow = 0;
      swapSettlementCashflow +=
        sign *
        ((notional * fixedRate * (timeEnd - timeSwap)) / 31536000) *
        0.01;

      swapSettlementCashflow -=
        sign *
        notional *
        number(
          ethers.utils.formatEther(
            await rateOracle.callStatic.variableFactor(
              toBn(timeSwap.toString()),
              await marginEngine.termEndTimestampWad()
            )
          )
        );

      overallSettlementCashflow += swapSettlementCashflow;

      console.log(swap);
      console.log("Swap Settlement Cashflow:", swapSettlementCashflow);
      console.log("");
    }

    console.log("Overall settlement cashflow:", overallSettlementCashflow);
  });

module.exports = {};
