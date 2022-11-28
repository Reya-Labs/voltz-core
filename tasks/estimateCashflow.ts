import { task } from "hardhat/config";
import {
  FixedAndVariableMathTest,
  MarginEngine,
  BaseRateOracle,
  IERC20Minimal,
} from "../typechain";
import { ethers, BigNumber } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";

const SECONDS_PER_YEAR = 31536000;

task(
  "checkInsolvencyAtMaturity",
  "Checks the insolvency status of positions at maturity by estimating the expected cashflow."
)
  .addFlag("onlyFullyUnwound", "Considers only fully unwound positions")
  .addOptionalParam("owners", "Filter by list of owners")
  .addOptionalParam("tickLowers", "Filter by tick lowers")
  .addOptionalParam("tickUppers", "Filter by tick uppers")
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

    let positions: Position[] = await getPositions(true);
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
      marginEngineAddresses.add(position.marginEngine);
    }

    console.log("Positions estimated to become insolvent at maturity:");

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

      const historicalAPY = await marginEngine.callStatic.getHistoricalApy();

      let estimatedVariableFactor = historicalAPY
        .div(BigNumber.from(10).pow(18))
        .mul(termEndTimestampWad.sub(termCurrentTimestampWad))
        .div(BigNumber.from(SECONDS_PER_YEAR.toString()));

      estimatedVariableFactor = estimatedVariableFactor.add(
        await baseRateOracle.variableFactorNoCache(
          termStartTimestampWad,
          termCurrentTimestampWad
        )
      );

      for (const position of positions) {
        if (position.marginEngine !== marginEngineAddress) {
          continue;
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

        const positionRequirementSafety =
          await marginEngine.callStatic.getPositionMarginRequirement(
            position.owner,
            position.tickLower,
            position.tickUpper,
            false
          );

        const positionRequirementLiquidation =
          await marginEngine.callStatic.getPositionMarginRequirement(
            position.owner,
            position.tickLower,
            position.tickUpper,
            true
          );

        let status = "HEALTHY";
        if (positionInfo.margin.lte(positionRequirementLiquidation)) {
          status = "DANGER";
        } else if (positionInfo.margin.lte(positionRequirementSafety)) {
          status = "WARNING";
        }

        if (positionInfo.margin.add(estimatedCashflow).lt(0)) {
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
            status,
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
