import { task } from "hardhat/config";
import {
  FixedAndVariableMathTest,
  MarginEngine,
  BaseRateOracle,
  IERC20Minimal,
} from "../typechain";
import { ethers, BigNumber } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import * as poolAddresses from "../pool-addresses/mainnet.json";

const SECONDS_PER_YEAR = 31536000;

task(
  "estimateCashflow",
  "Checks the insolvency status of positions at maturity by estimating the expected cashflow."
)
  .addFlag("onlyFullyUnwound", "Considers only fully unwound positions")
  .addFlag("onlyInsolvent", "Prints cashflows of insolvent positions only")
  .addOptionalParam("owners", "Filter by list of owners")
  .addOptionalParam("tickLowers", "Filter by tick lowers")
  .addOptionalParam("tickUppers", "Filter by tick uppers")
  .addOptionalParam(
    "pools",
    "The name of the pool (e.g. 'aDAI_v2', 'stETH_v1', etc.)"
  )
  .setAction(async (taskArgs, hre) => {
    let fixedAndVariableMath;
    if (hre.network.name === "mainnet") {
      fixedAndVariableMath = (await hre.ethers.getContractAt(
        "FixedAndVariableMathTest",
        "0x2D2EE238Ca74B546BfA64864f5654b5Ed7673f87"
      )) as FixedAndVariableMathTest;
    } else {
      console.log(
        "WARNING - Contract FixedAndVariableMathTest is going to be deployed on network:",
        hre.network.name
      );
      const fixedAndVariableMathFactory = await hre.ethers.getContractFactory(
        "FixedAndVariableMathTest"
      );
      fixedAndVariableMath =
        (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMathTest;
    }

    const poolNames = taskArgs.pools?.split(",") || [];
    const whitelistMarginEngines = poolNames.map((poolName: string) => {
      return poolAddresses[
        poolName as keyof typeof poolAddresses
      ].marginEngine.toLowerCase();
    });

    let positions: Position[] = await getPositions(
      Math.floor(Date.now() / 1000)
    );
    if (taskArgs.owners) {
      const filter_owners = taskArgs.owners
        .split(",")
        .map((p: string) => p.toLowerCase());

      positions = positions.filter((p) =>
        filter_owners.includes(p.owner.toLowerCase())
      );
    }

    if (taskArgs.tickLowers) {
      const filter_tickLowers = taskArgs.tickLowers.split(",");

      positions = positions.filter((p) =>
        filter_tickLowers.includes(p.tickLower.toString())
      );
    }

    if (taskArgs.tickUppers) {
      const filter_tickUppers = taskArgs.tickUppers.split(",");

      positions = positions.filter((p) =>
        filter_tickUppers.includes(p.tickUpper.toString())
      );
    }

    const marginEngineAddresses = new Set<string>();
    for (const position of positions) {
      if (
        whitelistMarginEngines.includes(position.marginEngine.toLowerCase()) ||
        whitelistMarginEngines.length === 0
      ) {
        marginEngineAddresses.add(position.marginEngine);
      }
    }

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

      const underlyingToken = (await hre.ethers.getContractAt(
        "IERC20Minimal",
        await baseRateOracle.underlying()
      )) as IERC20Minimal;

      const decimals = await underlyingToken.decimals();
      const termStartTimestampWad = await marginEngine.termStartTimestampWad();
      const termEndTimestampWad = await marginEngine.termEndTimestampWad();

      const marginEngineEndTimestamp = Number(
        ethers.utils.formatEther(await marginEngine.termEndTimestampWad())
      );

      if (marginEngineEndTimestamp <= currentBlock.timestamp) {
        continue;
      }

      console.log("New pool:", marginEngineAddress);

      const historicalAPY = await marginEngine.callStatic.getHistoricalApy();

      let estimatedVariableFactor = historicalAPY
        .mul(termEndTimestampWad.sub(termCurrentTimestampWad))
        .div(BigNumber.from(10).pow(18))
        .div(BigNumber.from(SECONDS_PER_YEAR.toString()));

      estimatedVariableFactor = estimatedVariableFactor.add(
        await baseRateOracle.variableFactorNoCache(
          termStartTimestampWad,
          termCurrentTimestampWad
        )
      );

      const positionsOfThisPool = positions.filter(
        (pos) =>
          pos.marginEngine.toLowerCase() === marginEngineAddress.toLowerCase()
      );

      for (let index = 0; index < positionsOfThisPool.length; index++) {
        const position = positionsOfThisPool[index];
        if (index % 20 === 0) {
          console.log(`${index}/${positionsOfThisPool.length}`);
        }

        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        if (
          taskArgs.onlyFullyUnwound &&
          positionInfo.variableTokenBalance.abs().gt(10)
        ) {
          continue;
        }

        const estimatedCashflow =
          await fixedAndVariableMath.calculateSettlementCashflow(
            positionInfo.fixedTokenBalance,
            positionInfo.variableTokenBalance,
            termStartTimestampWad,
            termEndTimestampWad,
            estimatedVariableFactor
          );

        if (
          !taskArgs.onlyInsolvent ||
          positionInfo.margin.add(estimatedCashflow).lt(0)
        ) {
          if (noneInsolvent) {
            console.log(
              "(Margin Engine, Owner, Lower Tick, Upper Tick, Status, Fixed Token Balance, Variable Token Balance, Current Margin, Estimated Cashflow Delta, Estimated Total Cashflow)"
            );
          }

          console.log(
            marginEngineAddress,
            position.owner,
            position.tickLower,
            position.tickUpper,
            ethers.utils.formatUnits(positionInfo.fixedTokenBalance, decimals),
            ethers.utils.formatUnits(
              positionInfo.variableTokenBalance,
              decimals
            ),
            ethers.utils.formatUnits(positionInfo.margin, decimals),
            ethers.utils.formatUnits(estimatedCashflow, decimals),
            ethers.utils.formatUnits(
              positionInfo.margin.add(estimatedCashflow),
              decimals
            )
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
