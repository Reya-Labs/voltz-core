import { task } from "hardhat/config";
import { MarginEngine, BaseRateOracle, IERC20Minimal } from "../typechain";
import { ethers, BigNumber } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import { getNetworkPools, getPool } from "../poolConfigs/pool-addresses/pools";
import { calculateSettlementCashflow } from "./utils/calculateSettlementCashflow";

task("maturedPositionsPnL", "Checks the PnL of matured positions")
  .addFlag("onlyInsolvent", "Prints information of insolvent positions only")
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

    const EXPORT_FILE = `${EXPORT_FOLDER}/matured-positions-pnl.csv`;

    const header =
      "Pool,Margin Engine,Owner,Lower Tick,Upper Tick,Settled,Margin,Pending Settlement Cashflow,Insolvency";
    fs.writeFile(EXPORT_FILE, header + "\n", () => {});

    let positions: Position[] = await getPositions(networkName, undefined);

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

      const termStartTimestampWad = await marginEngine.termStartTimestampWad();
      const termEndTimestampWad = await marginEngine.termEndTimestampWad();

      if (termCurrentTimestampWad.lt(termEndTimestampWad)) {
        continue;
      }

      const variableFactor = await baseRateOracle.variableFactorNoCache(
        termStartTimestampWad,
        termEndTimestampWad
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

        let pendingCashflow = BigNumber.from(0);
        if (!positionInfo.isSettled) {
          pendingCashflow = calculateSettlementCashflow(
            positionInfo.fixedTokenBalance,
            positionInfo.variableTokenBalance,
            termStartTimestampWad,
            termEndTimestampWad,
            variableFactor
          );
        }

        let insolvency = positionInfo.margin.add(pendingCashflow);
        if (insolvency.gt(BigNumber.from(0))) {
          insolvency = BigNumber.from(0);
        }

        if (!taskArgs.onlyInsolvent || insolvency.lt(0)) {
          fs.appendFileSync(
            EXPORT_FILE,
            `${pool},${poolDetails.marginEngine},${position.owner},${
              position.tickLower
            },${position.tickUpper},${
              positionInfo.isSettled
            },${ethers.utils.formatUnits(
              positionInfo.margin,
              poolDetails.decimals
            )},${ethers.utils.formatUnits(
              pendingCashflow,
              poolDetails.decimals
            )},${ethers.utils.formatUnits(insolvency, poolDetails.decimals)}\n`
          );
        }
      }
    }
  });

  task("getAllPoolsBalances", "Checks the PnL of matured positions")
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolNames: string[] = Object.keys(getNetworkPools(hre.network.name ));

    const networkName = hre.network.name;

    // Create a folder for the output data
    const EXPORT_FOLDER = `position-status/data/${networkName}`;
    const fs = require("fs");
    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }

    const EXPORT_FILE = `${EXPORT_FOLDER}/matured-positions-pnl.csv`;

    const header =
      "Pool,Margin Engine,Rate Oracle Id,Pending Withdraw,Pool Balance";
    fs.writeFile(EXPORT_FILE, header + "\n", () => {});

    let positions: Position[] = await getPositions(networkName, undefined);

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

      const underlyingTokenAddress = await marginEngine.underlyingToken();
      const underlyingToken = (await hre.ethers.getContractAt(
        "IERC20Minimal",
        underlyingTokenAddress
      )) as IERC20Minimal;

      const marginEngineBalance = await underlyingToken.balanceOf(poolDetails.marginEngine);

      const baseRateOracle = (await hre.ethers.getContractAt(
        "BaseRateOracle",
        await marginEngine.rateOracle()
      )) as BaseRateOracle;

      const termStartTimestampWad = await marginEngine.termStartTimestampWad();
      const termEndTimestampWad = await marginEngine.termEndTimestampWad();

      if (termCurrentTimestampWad.lt(termEndTimestampWad)) {
        continue;
      }

      const variableFactor = await baseRateOracle.variableFactorNoCache(
        termStartTimestampWad,
        termEndTimestampWad
      );

      const pool_positions = positions.filter(
        (p) => p.marginEngine === poolDetails.marginEngine.toLowerCase()
        && !p.isSettled
      );
      
      let totalPoolPendingWithdraws = 0;
      for (const position of pool_positions) {
        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        let pendingCashflow = BigNumber.from(0);
        if (!positionInfo.isSettled) {
          pendingCashflow = calculateSettlementCashflow(
            positionInfo.fixedTokenBalance,
            positionInfo.variableTokenBalance,
            termStartTimestampWad,
            termEndTimestampWad,
            variableFactor
          );
        }

        let insolvency = positionInfo.margin.add(pendingCashflow);
        
        totalPoolPendingWithdraws += insolvency.gt(BigNumber.from(0)) ?
           Number(hre.ethers.utils.formatUnits(insolvency, poolDetails.decimals)) : 0;

      }
      fs.appendFileSync(
        EXPORT_FILE,
        `${pool},${poolDetails.marginEngine},${poolDetails.rateOracleID},${
          totalPoolPendingWithdraws
        },${marginEngineBalance}\n`
      );
    }
  });

module.exports = {};
