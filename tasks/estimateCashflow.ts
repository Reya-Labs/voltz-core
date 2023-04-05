import { task } from "hardhat/config";
import { MarginEngine, BaseRateOracle, IERC20Minimal } from "../typechain";
import { ethers, BigNumber } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import { getSigner } from "./utils/getSigner";
import { getPool } from "../poolConfigs/pool-addresses/pools";
import { calculateSettlementCashflow } from "./utils/calculateSettlementCashflow";

const SECONDS_PER_YEAR = 31536000;

task(
  "estimateCashflow",
  "Checks the insolvency status of positions at maturity by estimating the expected cashflow."
)
  .addFlag("onlyFullyUnwound", "Considers only fully unwound positions")
  .addFlag("onlyActive", "Considers only active positions")
  .addFlag("onlyInsolvent", "Prints cashflows of insolvent positions only")
  .addFlag(
    "onlyLiquidatable",
    "Prints cashflows of liquidatable positions only"
  )
  .addOptionalParam("owners", "Filter by list of owners")
  .addOptionalParam("tickLowers", "Filter by tick lowers")
  .addOptionalParam("tickUppers", "Filter by tick uppers")
  .addOptionalParam(
    "networkName",
    "Name of underlying network when using forks"
  )
  .addVariadicPositionalParam("pools", "Comma-separated pool names")
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;

    let networkName = hre.network.name;
    if (taskArgs.networkName) {
      if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        throw new Error(`Cannot redefine name for network ${hre.network.name}`);
      }

      networkName = taskArgs.networkName;
    }

    // Create a folder for the output data
    const EXPORT_FOLDER = `position-status/data/${networkName}`;
    const fs = require("fs");
    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }

    const EXPORT_FILE = `${EXPORT_FOLDER}/estimated-cashflow.csv`;

    const header =
      "Margin Engine,Owner,Lower Tick,Upper Tick,Status,Fixed Token Balance,Variable Token Balance,Current Margin,Accumulated Fees,Estimated Cashflow,Estimated PnL,Estimated Insolvency,Margin After Liquidation,Estimated Cashflow After Liquidation,Estimated PnL After Liquidation,Estimated Insolvency After Liquidation";
    fs.writeFile(EXPORT_FILE, header + "\n", () => {});

    const { deployer } = await hre.getNamedAccounts();
    const localhostLiquidator = await getSigner(hre, deployer);

    let positions: Position[] = await getPositions(
      networkName,
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

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const termCurrentTimestampWad = BigNumber.from(currentBlock.timestamp).mul(
      BigNumber.from(10).pow(18)
    );

    for (const pool of poolNames) {
      console.log(`Processing pool ${pool}`);

      const poolDetails = getPool(hre.network.name, pool);

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        poolDetails.marginEngine
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
        .mul(termEndTimestampWad.sub(termCurrentTimestampWad))
        .div(BigNumber.from(10).pow(18))
        .div(BigNumber.from(SECONDS_PER_YEAR.toString()));

      estimatedVariableFactor = estimatedVariableFactor.add(
        await baseRateOracle.variableFactorNoCache(
          termStartTimestampWad,
          termCurrentTimestampWad
        )
      );

      const pool_positions = positions.filter(
        (p) => p.marginEngine === poolDetails.marginEngine.toLowerCase()
      );

      for (const position of pool_positions) {
        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        if (
          taskArgs.onlyFullyUnwound &&
          positionInfo.variableTokenBalance.abs().gt(100)
        ) {
          continue;
        }

        if (
          taskArgs.onlyActive &&
          positionInfo.variableTokenBalance.abs().lte(100)
        ) {
          continue;
        }

        const estimatedCashflow = await calculateSettlementCashflow(
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
        if (positionInfo.margin.lt(positionRequirementLiquidation)) {
          status = "DANGER";
        } else if (positionInfo.margin.lt(positionRequirementSafety)) {
          status = "WARNING";
        }

        if (status !== "DANGER" && taskArgs.onlyLiquidatable) {
          continue;
        }

        let marginAfterLiquidation: BigNumber | null = null;
        let estimatedCashflowAfterLiquidation: BigNumber | null = null;
        if (localhostLiquidator && status === "DANGER") {
          if (
            !positionInfo.variableTokenBalance.isZero() &&
            positionRequirementLiquidation.gt(BigNumber.from(0))
          ) {
            await marginEngine
              .connect(localhostLiquidator)
              .liquidatePosition(
                position.owner,
                position.tickLower,
                position.tickUpper
              );
          }

          const positionInfoAfterLiquidation =
            await marginEngine.callStatic.getPosition(
              position.owner,
              position.tickLower,
              position.tickUpper
            );

          marginAfterLiquidation = positionInfoAfterLiquidation.margin;

          estimatedCashflowAfterLiquidation = await calculateSettlementCashflow(
            positionInfoAfterLiquidation.fixedTokenBalance,
            positionInfoAfterLiquidation.variableTokenBalance,
            termStartTimestampWad,
            termEndTimestampWad,
            estimatedVariableFactor
          );
        }

        if (
          !taskArgs.onlyInsolvent ||
          positionInfo.margin.add(estimatedCashflow).lt(0)
        ) {
          const output = [
            // Margin Engine
            poolDetails.marginEngine,
            // Owner
            position.owner,
            // Lower Tick
            position.tickLower,
            // Upper Tick
            position.tickUpper,
            // Status
            status,
            // Fixed Token Balance
            ethers.utils.formatUnits(positionInfo.fixedTokenBalance, decimals),
            // Variable Token Balance
            ethers.utils.formatUnits(
              positionInfo.variableTokenBalance,
              decimals
            ),
            // Current Margin
            ethers.utils.formatUnits(positionInfo.margin, decimals),
            // Accumulated Fees
            ethers.utils.formatUnits(positionInfo.accumulatedFees, decimals),
            // Estimated Cashflow
            ethers.utils.formatUnits(estimatedCashflow, decimals),
            // Estimated PnL,
            ethers.utils.formatUnits(
              positionInfo.margin.add(estimatedCashflow),
              decimals
            ),
            // Estimated Insolvency
            positionInfo.margin.add(estimatedCashflow).lt(0)
              ? ethers.utils.formatUnits(
                  positionInfo.margin.add(estimatedCashflow),
                  decimals
                )
              : 0,
            // Margin After Liquidation
            marginAfterLiquidation
              ? ethers.utils.formatUnits(marginAfterLiquidation, decimals)
              : "N/A",
            // Estimated Cashflow After Liquidation
            estimatedCashflowAfterLiquidation
              ? ethers.utils.formatUnits(
                  estimatedCashflowAfterLiquidation,
                  decimals
                )
              : "N/A",
            // Estimated PnL After Liquidation
            marginAfterLiquidation && estimatedCashflowAfterLiquidation
              ? ethers.utils.formatUnits(
                  marginAfterLiquidation.add(estimatedCashflowAfterLiquidation),
                  decimals
                )
              : "N/A",
            // Estimated Insolvency After Liquidation
            marginAfterLiquidation && estimatedCashflowAfterLiquidation
              ? marginAfterLiquidation
                  .add(estimatedCashflowAfterLiquidation)
                  .lt(0)
                ? ethers.utils.formatUnits(
                    marginAfterLiquidation.add(
                      estimatedCashflowAfterLiquidation
                    ),
                    decimals
                  )
                : 0
              : "N/A",
          ].join(",");

          fs.appendFileSync(EXPORT_FILE, output + "\n");
        }
      }
    }
  });

module.exports = {};
