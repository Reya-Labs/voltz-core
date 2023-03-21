import { task } from "hardhat/config";
import {
  FixedAndVariableMathTest,
  MarginEngine,
  BaseRateOracle,
  IERC20Minimal,
} from "../typechain";
import { ethers, BigNumber } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const SECONDS_PER_YEAR = 31536000;

async function impersonateAccount(
  hre: HardhatRuntimeEnvironment,
  acctAddress: string
) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  // It might be a multisig contract, in which case we also need to pretend it has money for gas
  await hre.ethers.provider.send("hardhat_setBalance", [
    acctAddress,
    "0x10000000000000000000",
  ]);
}

async function getSigner(hre: HardhatRuntimeEnvironment, acctAddress: string) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    // We can impersonate the account
    await impersonateAccount(hre, acctAddress);
    return await hre.ethers.getSigner(acctAddress);
  }
  return null;
}

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
  .setAction(async (taskArgs, hre) => {
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
      "Margin Engine,Owner,Lower Tick,Upper Tick,Status,Fixed Token Balance,Variable Token Balance,Current Margin,Estimated Cashflow,Estimated PnL,Estimated Insolvency,Margin After Liquidation,Estimated Cashflow After Liquidation,Estimated PnL After Liquidation,Estimated Insolvency After Liquidation";
    fs.writeFile(EXPORT_FILE, header + "\n", () => {});

    const { deployer } = await hre.getNamedAccounts();
    const localhostLiquidator = await getSigner(hre, deployer);

    // TODO: hard-coded account (suggestion: move this to some utility
    // that gets hre.network.name as argument and returns the FixedAndVariableMath
    // library)
    let fixedAndVariableMath;
    if (networkName === "mainnet") {
      fixedAndVariableMath = (await hre.ethers.getContractAt(
        "FixedAndVariableMathTest",
        "0x2D2EE238Ca74B546BfA64864f5654b5Ed7673f87"
      )) as FixedAndVariableMathTest;
    } else if (networkName === "arbitrum") {
      fixedAndVariableMath = (await hre.ethers.getContractAt(
        "FixedAndVariableMathTest",
        "0x6975b83ef331e65d146e4c64fb45392cd2237a3c"
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

    const marginEngineAddresses = new Set<string>();
    for (const position of positions) {
      marginEngineAddresses.add(position.marginEngine);
    }

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const termCurrentTimestampWad = BigNumber.from(currentBlock.timestamp).mul(
      BigNumber.from(10).pow(18)
    );

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
        .mul(termEndTimestampWad.sub(termCurrentTimestampWad))
        .div(BigNumber.from(10).pow(18))
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

          estimatedCashflowAfterLiquidation =
            await fixedAndVariableMath.calculateSettlementCashflow(
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
          fs.appendFileSync(
            EXPORT_FILE,
            `${marginEngineAddress},${position.owner},${position.tickLower},${
              position.tickUpper
            },${status},${ethers.utils.formatUnits(
              positionInfo.fixedTokenBalance,
              decimals
            )},${ethers.utils.formatUnits(
              positionInfo.variableTokenBalance,
              decimals
            )},${ethers.utils.formatUnits(
              positionInfo.margin,
              decimals
            )},${ethers.utils.formatUnits(
              estimatedCashflow,
              decimals
            )},${ethers.utils.formatUnits(
              positionInfo.margin.add(estimatedCashflow),
              decimals
            )},${
              positionInfo.margin.add(estimatedCashflow).lt(0)
                ? ethers.utils.formatUnits(
                    positionInfo.margin.add(estimatedCashflow),
                    decimals
                  )
                : 0
            },${
              marginAfterLiquidation
                ? ethers.utils.formatUnits(marginAfterLiquidation, decimals)
                : "N/A"
            },${
              estimatedCashflowAfterLiquidation
                ? ethers.utils.formatUnits(
                    estimatedCashflowAfterLiquidation,
                    decimals
                  )
                : "N/A"
            },${
              marginAfterLiquidation && estimatedCashflowAfterLiquidation
                ? ethers.utils.formatUnits(
                    marginAfterLiquidation.add(
                      estimatedCashflowAfterLiquidation
                    ),
                    decimals
                  )
                : "N/A"
            },${
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
                : "N/A"
            }\n`
          );
        }
      }
    }
  });

module.exports = {};
