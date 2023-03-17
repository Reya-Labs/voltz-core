import { task, types } from "hardhat/config";
import { BaseRateOracle, MarginEngine, VAMM } from "../typechain";
import { ethers } from "ethers";
import { getPositions, Position } from "../scripts/getPositions";
import { PositionHistory } from "../scripts/getPositionHistory";
import {
  getBlockAtTimestamp,
  getPositionInfo,
  getPositionRequirements,
  sortPositions,
} from "./utils/helpers";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";

const blocksPerDay = 6570; // 13.15 seconds per block

const formatNumber = (value: number): string => {
  return value.toFixed(4);
};

task("checkPositionsHealth", "Check positions")
  .addParam("exportFolder", "Folder to export")
  .addOptionalParam(
    "pools",
    "Comma-separated pool names as in pool-addresses/mainnet.json"
  )
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    // Get pool addresses of the given network
    const poolAddresses = getNetworkPools(hre.network.name);

    // Get the queried pool names
    const poolNames: string[] = taskArgs.pools
      ? taskArgs.pools.split(",")
      : Object.keys(poolAddresses).filter((item) => !(item === "default"));

    // Generate margin engine and output file for each pool
    const pools: {
      [name: string]: {
        index: number;
        file: string;
        decimals: number;
        marginEngine: MarginEngine;
      };
    } = {};

    const EXPORT_FOLDER = `position-status/data/${taskArgs.exportFolder}`;

    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }

    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      const tmp = poolAddresses[p as keyof typeof poolAddresses];

      if (!tmp) {
        throw new Error(`Pool ${p} doesnt's exist.`);
      }

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        tmp.marginEngine
      )) as MarginEngine;

      pools[tmp.marginEngine.toLowerCase()] = {
        index: i,
        file: `${EXPORT_FOLDER}/${p}.csv`,
        decimals: tmp.decimals,
        marginEngine: marginEngine,
      };
    }

    // Create the header and write it in each pool output file
    const header =
      "margin_engine,owner,lower_tick,upper_tick,position_margin,position_liquidity,position_notional,position_requirement_liquidation,position_requirement_safety,status";

    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      fs.writeFile(
        `position-status/data/${taskArgs.exportFolder}/${p}.csv`,
        header + "\n",
        () => {}
      );
    }
    console.log(header);

    // Fetch all positions and filter out the positions that are not in the queried pools
    let positions: Position[] = await getPositions(hre.network.name);
    positions = positions.filter((p) =>
      Object.keys(pools).includes(p.marginEngine.toLowerCase())
    );

    // Sort positions
    positions = sortPositions(positions, pools);

    for (
      let position_index = 0;
      position_index < positions.length;
      position_index += 1
    ) {
      const position = positions[position_index];

      // Log the progress
      if (position_index % 100 === 0) {
        console.log(`${position_index}/${positions.length} positions`);
      }

      const tmp =
        pools[position.marginEngine.toLowerCase() as keyof typeof pools];

      const marginEngine = tmp.marginEngine;
      const decimals = tmp.decimals;

      const { safetyThreshold, liquidationThreshold } =
        await getPositionRequirements(marginEngine, position, decimals);

      const { liquidity, margin, variableTokenBalance } = await getPositionInfo(
        marginEngine,
        position,
        decimals
      );

      let status = "HEALTHY";
      if (margin < liquidationThreshold) {
        status = "DANGER";
      } else if (margin < safetyThreshold) {
        status = "WARNING";
      }

      const info = `${marginEngine.address},${position.owner},${
        position.tickLower
      },${position.tickUpper},${formatNumber(margin)},${formatNumber(
        liquidity
      )},${formatNumber(variableTokenBalance)},${formatNumber(
        liquidationThreshold
      )},${formatNumber(safetyThreshold)},${status}\n`;

      console.log(info);

      fs.appendFileSync(tmp.file, info + "\n");
    }
  });

task("getPositionInfo", "Get all information about some position")
  .addOptionalParam(
    "pools",
    "Filter by list of pool names as they appear in pool-addresses/mainnet.json"
  )
  .addOptionalParam("owners", "Filter by list of owners")
  .addOptionalParam("tickLowers", "Filter by tick lowers")
  .addOptionalParam("tickUppers", "Filter by tick uppers")
  .addFlag("healthHistory", "Flag that gets health history")
  .addParam(
    "blockInterval",
    "Script will fetch data every `blockInterval` blocks (between `fromBlock` and `toBlock`)",
    blocksPerDay,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    // Get the queried pool names
    const poolAddresses = getNetworkPools(hre.network.name);

    // Get the queried pool names
    const poolNames: string[] = taskArgs.pools
      ? taskArgs.pools.split(",")
      : Object.keys(poolAddresses).filter((item) => !(item === "default"));

    // Generate smart contracts for each pool
    const pools: {
      [name: string]: {
        index: number;
        decimals: number;
        marginEngine: MarginEngine;
        rateOracle: BaseRateOracle;
        name: string;
        deploymentBlock: number;
      };
    } = {};

    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      const tmp = poolAddresses[p as keyof typeof poolAddresses];

      if (!tmp) {
        throw new Error(`Pool ${p} doesn't exist.`);
      }

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        tmp.marginEngine
      )) as MarginEngine;

      const rateOracleAddress = await marginEngine.rateOracle();

      const rateOracle = (await hre.ethers.getContractAt(
        "BaseRateOracle",
        rateOracleAddress
      )) as BaseRateOracle;

      pools[tmp.marginEngine.toLowerCase()] = {
        index: i,
        decimals: tmp.decimals,
        marginEngine: marginEngine,
        rateOracle: rateOracle,
        name: p,
        deploymentBlock: tmp.deploymentBlock,
      };
    }

    // Fetch all positions and filter out the positions that are not in the queried pools
    let positions: Position[] = await getPositions(hre.network.name);
    positions = positions.filter((p) =>
      Object.keys(pools).includes(p.marginEngine.toLowerCase())
    );

    // Filter by owners
    if (taskArgs.owners) {
      const filter_owners = taskArgs.owners
        .split(",")
        .map((p: string) => p.toLowerCase());

      positions = positions.filter((p) =>
        filter_owners.includes(p.owner.toLowerCase())
      );
    }

    // Filter by lower ticks
    if (taskArgs.tickLowers) {
      const filter_tickLowers = taskArgs.tickLowers.split(",");

      positions = positions.filter((p) =>
        filter_tickLowers.includes(p.tickLower.toString())
      );
    }

    // Filter by upper ticks
    if (taskArgs.tickUppers) {
      const filter_tickUppers = taskArgs.tickUppers.split(",");

      positions = positions.filter((p) =>
        filter_tickUppers.includes(p.tickUpper.toString())
      );
    }

    // Sort positions
    positions = sortPositions(positions, pools);

    for (
      let position_index = 0;
      position_index < positions.length;
      position_index += 1
    ) {
      const p = positions[position_index];

      // Log the progress
      if (position_index % 100 === 0) {
        console.log(`${position_index}/${positions.length} positions`);
      }

      const tmp = pools[p.marginEngine.toLowerCase() as keyof typeof pools];

      // Create a folder for this position
      const EXPORT_FOLDER = `position-status/data/${hre.network.name}#${tmp.name}#${p.owner}#${p.tickLower}#${p.tickUpper}`;

      if (!fs.existsSync(EXPORT_FOLDER)) {
        fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
      }

      // Empty the file info.txt inside the folder
      fs.writeFile(`${EXPORT_FOLDER}/info.txt`, "", () => {});
      fs.writeFile(`${EXPORT_FOLDER}/mints.csv`, "", () => {});
      fs.writeFile(`${EXPORT_FOLDER}/swaps.csv`, "", () => {});
      fs.writeFile(`${EXPORT_FOLDER}/margin_updates.csv`, "", () => {});
      fs.writeFile(`${EXPORT_FOLDER}/liquidations.csv`, "", () => {});
      fs.writeFile(`${EXPORT_FOLDER}/settlements.csv`, "", () => {});

      // Output the identifiers of the positions
      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `Pool: ${tmp.name}\n`);
      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `Owner: ${p.owner}\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `Tick range: ${p.tickLower} -> ${p.tickUpper}\n`
      );

      // Output the fixed rate range
      const fixedRateLower = 1.0001 ** -p.tickUpper;
      const fixedRateUpper = 1.0001 ** -p.tickLower;

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `Fixed rate range: ${formatNumber(fixedRateLower)}% -> ${formatNumber(
          fixedRateUpper
        )}%\n`
      );

      // Get the vamm and output the current fixed rate
      const vamm = (await hre.ethers.getContractAt(
        "VAMM",
        await tmp.marginEngine.vamm()
      )) as VAMM;

      const tick = (await vamm.vammVars()).tick;
      const currentFixedRate = 1.0001 ** -tick;

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `Current fixed rate: ${formatNumber(currentFixedRate)}%\n`
      );

      // Get the margin requirements
      let safetyThreshold = 0;
      let liquidationThreshold = 0;

      try {
        const marginRequiremens = await getPositionRequirements(
          tmp.marginEngine,
          p,
          tmp.decimals
        );

        safetyThreshold = marginRequiremens.safetyThreshold;
        liquidationThreshold = marginRequiremens.liquidationThreshold;
      } catch {}

      // Get the position info
      const { liquidity, margin, fixedTokenBalance, variableTokenBalance } =
        await getPositionInfo(tmp.marginEngine, p, tmp.decimals);

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `Liquidity: ${formatNumber(liquidity)}\n`
      );

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `Fixed tokens: ${formatNumber(
          fixedTokenBalance
        )}, Variable tokens: ${formatNumber(variableTokenBalance)}\n`
      );

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `Margin: ${margin}, Liquidation: ${formatNumber(
          liquidationThreshold
        )}, Safety: ${formatNumber(safetyThreshold)}\n`
      );

      // Get action history
      const history = new PositionHistory(
        `${p.marginEngine.toLowerCase()}#${p.owner.toLowerCase()}#${
          p.tickLower
        }#${p.tickUpper}`,
        p.tickLower,
        p.tickUpper,
        tmp.decimals
      );

      await history.getInfo(hre.network.name);

      // Output mints
      fs.appendFileSync(
        `${EXPORT_FOLDER}/mints.csv`,
        "timestamp,date,notional,tx_url\n"
      );
      for (const item of history.mints) {
        const date = new Date(item.timestamp * 1000).toISOString();
        const txURL = `etherscan.io/tx/${item.transaction}`;

        fs.appendFileSync(
          `${EXPORT_FOLDER}/mints.csv`,
          `${item.timestamp},${date},${formatNumber(item.notional)},${txURL}\n`
        );
      }

      // Output burns
      for (const item of history.burns) {
        const date = new Date(item.timestamp * 1000).toISOString();
        const txURL = `etherscan.io/tx/${item.transaction}`;

        fs.appendFileSync(
          `${EXPORT_FOLDER}/mints.csv`,
          `${item.timestamp},${date},-${formatNumber(item.notional)},${txURL}\n`
        );
      }

      // Output swaps
      fs.appendFileSync(
        `${EXPORT_FOLDER}/swaps.csv`,
        "timestamp,date,notional,avg_fixed_rate,fees,tx_url\n"
      );
      for (const item of history.swaps) {
        const avgFixedRate =
          item.variableTokenDelta === 0
            ? 0
            : -item.unbalancedFixedTokenDelta / item.variableTokenDelta;

        const date = new Date(item.timestamp * 1000).toISOString();
        const txURL = `etherscan.io/tx/${item.transaction}`;

        fs.appendFileSync(
          `${EXPORT_FOLDER}/swaps.csv`,
          `${item.timestamp},${date},${formatNumber(
            item.variableTokenDelta
          )},${formatNumber(avgFixedRate)}%,${formatNumber(
            item.fees
          )},${txURL}\n`
        );
      }

      // Output margin updates
      fs.appendFileSync(
        `${EXPORT_FOLDER}/margin_updates.csv`,
        "timestamp,date,margin_delta,tx_url\n"
      );

      for (const item of history.marginUpdates) {
        const date = new Date(item.timestamp * 1000).toISOString();
        const txURL = `etherscan.io/tx/${item.transaction}`;

        fs.appendFileSync(
          `${EXPORT_FOLDER}/margin_updates.csv`,
          `${item.timestamp},${date},${formatNumber(
            item.marginDelta
          )},${txURL}\n`
        );
      }

      // Output liquidations
      fs.appendFileSync(
        `${EXPORT_FOLDER}/liquidations.csv`,
        "timestamp,date,reward,tx_url\n"
      );

      for (const item of history.liquidations) {
        const date = new Date(item.timestamp * 1000).toISOString();
        const txURL = `etherscan.io/tx/${item.transaction}`;

        fs.appendFileSync(
          `${EXPORT_FOLDER}/liquidations.csv`,
          `${item.timestamp},${date},${formatNumber(item.reward)},${txURL}\n`
        );
      }

      // Output settlements
      fs.appendFileSync(
        `${EXPORT_FOLDER}/settlements.csv`,
        "timestamp,date,settlement_cashflow,tx_url\n"
      );

      for (const item of history.settlements) {
        const date = new Date(item.timestamp * 1000).toISOString();
        const txURL = `etherscan.io/tx/${item.transaction}`;

        fs.appendFileSync(
          `${EXPORT_FOLDER}/settlements.csv`,
          `${item.timestamp},${date},${formatNumber(
            item.settlementCashflow
          )},${txURL}\n`
        );
      }

      // Output the behaviour of margin requirement over time
      if (taskArgs.healthHistory) {
        const currentBlock = await hre.ethers.provider.getBlock("latest");
        const currentBlockNumber = currentBlock.number;

        const header =
          "timestamp,block,fixed_rate,position_margin,position_requirement_liquidation,position_requirement_safety,fixed_token_balance,variable_token_balance\n";

        fs.writeFile(`${EXPORT_FOLDER}/progress.csv`, header, () => {});

        const startTimestamp = Number(
          ethers.utils.formatUnits(
            await tmp.marginEngine.termStartTimestampWad(),
            18
          )
        );

        const startBlock = Math.max(
          await getBlockAtTimestamp(hre, startTimestamp),
          tmp.deploymentBlock
        );

        const totalIterations =
          Math.floor(
            (currentBlockNumber - startBlock) / taskArgs.blockInterval
          ) +
          ((currentBlockNumber - startBlock) % taskArgs.blockInterval === 0
            ? 0
            : 1);

        for (
          let b = startBlock + 1, iterations = 0;
          b <= currentBlockNumber;
          iterations += 1
        ) {
          const block = await hre.ethers.provider.getBlock(b);

          // Log for progress
          if (iterations % 10 === 0) {
            console.log(`${iterations}/${totalIterations} iterations`);
          }

          const { liquidationThreshold, safetyThreshold } =
            await getPositionRequirements(tmp.marginEngine, p, tmp.decimals, b);

          // Get the position info
          const { margin, fixedTokenBalance, variableTokenBalance } =
            await getPositionInfo(tmp.marginEngine, p, tmp.decimals, b);

          const tick = (await vamm.vammVars({ blockTag: b })).tick;
          const currentFixedRate = 1.0001 ** -tick;

          fs.appendFileSync(
            `${EXPORT_FOLDER}/progress.csv`,
            `${block.timestamp},${b},${formatNumber(
              currentFixedRate
            )}%,${margin},${liquidationThreshold},${safetyThreshold},${fixedTokenBalance},${variableTokenBalance}\n`
          );

          if (b >= currentBlockNumber) {
            break;
          }
          b = Math.min(currentBlockNumber, b + taskArgs.blockInterval);
        }
      }
    }
  });

task("checkMaturityPnL", "Check positions' P&L at maturity")
  .addFlag("traders", "Considers only traders")
  .addFlag("lps", "Considers only LPs")
  .addOptionalParam(
    "pools",
    "Filter by list of pool names as they appear in pool-addresses/mainnet.json"
  )
  .addOptionalParam("owners", "Filter by list of owners")
  .addOptionalParam("tickLowers", "Filter by tick lowers")
  .addOptionalParam("tickUppers", "Filter by tick uppers")
  .setAction(async (taskArgs, hre) => {
    const currentTimestamp = (await hre.ethers.provider.getBlock("latest"))
      .timestamp;

    let positions: Position[] = await getPositions(hre.network.name);

    const pools: {
      [name: string]: {
        index: number;
        decimals: number;
        marginEngine: MarginEngine;
        name: string;
        termEndTimestamp: number;
        file: string;
      };
    } = {};

    const poolAddresses = getNetworkPools(hre.network.name);

    const poolNames: string[] = taskArgs.pools
      ? taskArgs.pools.split(",")
      : Object.keys(poolAddresses);

    const filter_pools: string[] = [];

    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];

      if (p === "default") {
        continue;
      }

      const tmp = poolAddresses[p as keyof typeof poolAddresses];

      if (!tmp) {
        throw new Error(`Pool ${p} doesnt's exist.`);
      }

      filter_pools.push(tmp.marginEngine.toLowerCase());

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        tmp.marginEngine
      )) as MarginEngine;

      const termEndTimestampWad = await marginEngine.termEndTimestampWad();

      pools[tmp.marginEngine.toLowerCase()] = {
        index: i,
        decimals: tmp.decimals,
        marginEngine: marginEngine,
        name: p,
        termEndTimestamp: Number(ethers.utils.formatEther(termEndTimestampWad)),
        file: `position-status/data/maturity-pnl/${p}.csv`,
      };
    }

    positions = positions.filter((p) =>
      filter_pools.includes(p.marginEngine.toLowerCase())
    );

    positions = positions.filter((p) => p.isSettled);

    if (taskArgs.traders) {
      positions = positions.filter((p) => p.positionType !== 3);
    }

    if (taskArgs.lps) {
      positions = positions.filter((p) => p.positionType === 3);
    }

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

    positions.sort((a, b) => {
      const i_a =
        pools[a.marginEngine.toLowerCase() as keyof typeof pools].index;
      const i_b =
        pools[b.marginEngine.toLowerCase() as keyof typeof pools].index;

      if (i_a === i_b) {
        if (a.owner.toLowerCase() === b.owner.toLowerCase()) {
          if (a.tickLower === b.tickLower) {
            return a.tickUpper - b.tickUpper;
          } else {
            return a.tickLower - b.tickLower;
          }
        } else {
          return a.owner.toLowerCase() < b.owner.toLowerCase() ? -1 : 1;
        }
      } else {
        return i_a < i_b ? -1 : 1;
      }
    });

    const fs = require("fs");

    const EXPORT_FOLDER = `position-status/data/maturity-pnl`;

    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }

    const header =
      "pool,margin_engine,owner,tick_lower,tick_upper,margin_in,settlement_cashflow,lp_fees,pnl\n";
    fs.writeFile(`${EXPORT_FOLDER}/all-pools.csv`, header, () => {});
    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      if (p === "default") {
        continue;
      }

      const tmp = poolAddresses[p as keyof typeof poolAddresses];
      const pool = pools[tmp.marginEngine.toLowerCase() as keyof typeof pools];
      if (currentTimestamp <= pool.termEndTimestamp) {
        continue;
      }

      fs.writeFile(`${EXPORT_FOLDER}/${p}.csv`, header, () => {});
    }

    for (const p of positions) {
      const tmp = pools[p.marginEngine.toLowerCase() as keyof typeof pools];

      const history = new PositionHistory(
        `${p.marginEngine.toLowerCase()}#${p.owner.toLowerCase()}#${
          p.tickLower
        }#${p.tickUpper}`,
        p.tickLower,
        p.tickUpper,
        tmp.decimals
      );

      await history.getInfo(hre.network.name);

      let pnl = 0;
      let margin_in = 0;
      for (const item of history.marginUpdates) {
        pnl -= item.marginDelta;
        if (item.marginDelta > 0) {
          margin_in += item.marginDelta;
        }
      }

      if (history.settlements.length !== 1) {
        console.log(
          `Error: more than 1 settlements for position ${p.owner}, ${p.tickLower}, ${p.tickUpper}`
        );

        return;
      }

      const settlement_cashflow = history.settlements[0].settlementCashflow;

      const lp_fees = pnl - settlement_cashflow;

      const csv_row = `${tmp.name},${p.marginEngine},${p.owner},${p.tickLower},${p.tickUpper},${margin_in},${settlement_cashflow},${lp_fees},${pnl}\n`;

      fs.appendFileSync(`${EXPORT_FOLDER}/all-pools.csv`, csv_row);
      fs.appendFileSync(tmp.file, csv_row);
    }
  });

module.exports = {};
