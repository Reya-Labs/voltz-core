import { task, types } from "hardhat/config";
import { BaseRateOracle, MarginEngine, VAMM } from "../typechain";
import { BigNumber, BigNumberish, ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { getPositions, Position } from "../scripts/getPositions";
import { PositionHistory } from "../scripts/getPositionHistory";
import * as poolAddresses from "../pool-addresses/mainnet.json";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const blocksPerDay = 6570; // 13.15 seconds per block

async function getBlockAtTimestamp(
  hre: HardhatRuntimeEnvironment,
  timestamp: number
) {
  let lo = 0;
  let hi = (await hre.ethers.provider.getBlock("latest")).number;
  let answer = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midBlock = await hre.ethers.provider.getBlock(mid);

    // console.log(midBlock.timestamp, timestamp);

    if (midBlock.timestamp >= timestamp) {
      answer = midBlock.number;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return answer;
}

task("checkPositionsHealth", "Check positions")
  .addParam("exportFolder", "Folder to export")
  .addParam(
    "pools",
    "Comma-separated pool names as in pool-addresses/mainnet.json"
  )
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    const poolNames = taskArgs.pools.split(",");

    const pools: {
      [name: string]: {
        index: number;
        file: string;
        decimals: number;
        marginEngine: MarginEngine;
      };
    } = {};
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
        file: `position-status/data/${taskArgs.exportFolder}/${p}.csv`,
        decimals: tmp.decimals,
        marginEngine: marginEngine,
      };
    }

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

    let positions: Position[] = await getPositions();
    positions = positions.filter((p) =>
      Object.keys(pools).includes(p.marginEngine.toLowerCase())
    );
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

    console.log("# of positions:", positions.length);

    for (const position of positions) {
      const tmp =
        pools[position.marginEngine.toLowerCase() as keyof typeof pools];

      const marginEngine = tmp.marginEngine;
      const decimals = tmp.decimals;

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

      const positionInfo = await marginEngine.callStatic.getPosition(
        position.owner,
        position.tickLower,
        position.tickUpper
      );

      let status = "HEALTHY";
      if (positionInfo.margin.lte(positionRequirementLiquidation)) {
        status = "DANGER";
      } else if (positionInfo.margin.lte(positionRequirementSafety)) {
        status = "WARNING";
      }

      console.log(
        marginEngine.address,
        position.owner,
        position.tickLower,
        position.tickUpper,
        ethers.utils.formatUnits(positionInfo.margin, decimals),
        ethers.utils.formatUnits(positionInfo._liquidity, decimals),
        ethers.utils.formatUnits(positionInfo.variableTokenBalance, decimals),
        ethers.utils.formatUnits(positionRequirementLiquidation, decimals),
        ethers.utils.formatUnits(positionRequirementSafety, decimals),
        status
      );
      fs.appendFileSync(
        tmp.file,
        `${marginEngine.address},${position.owner},${position.tickLower},${
          position.tickUpper
        },${ethers.utils.formatUnits(
          positionInfo.margin,
          decimals
        )},${ethers.utils.formatUnits(
          positionInfo._liquidity,
          decimals
        )},${ethers.utils.formatUnits(
          positionInfo.variableTokenBalance,
          decimals
        )},${ethers.utils.formatUnits(
          positionRequirementLiquidation,
          decimals
        )},${ethers.utils.formatUnits(
          positionRequirementSafety,
          decimals
        )},${status}\n`
      );
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
    let positions: Position[] = await getPositions();

    const pools: {
      [name: string]: {
        index: number;
        decimals: number;
        marginEngine: MarginEngine;
        rateOracle: BaseRateOracle;
        name: string;
      };
    } = {};

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
      // console.log(tmp.marginEngine.toLowerCase());

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
      };
    }

    positions = positions.filter((p) =>
      filter_pools.includes(p.marginEngine.toLowerCase())
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

    console.log("positions:", positions);

    const fs = require("fs");

    for (const p of positions) {
      const tmp = pools[p.marginEngine.toLowerCase() as keyof typeof pools];

      const EXPORT_FOLDER = `position-status/data/${tmp.name}#${p.owner}#${p.tickLower}#${p.tickUpper}`;

      if (!fs.existsSync(EXPORT_FOLDER)) {
        fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
      }

      fs.writeFile(`${EXPORT_FOLDER}/info.txt`, "", () => {});

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `POOL: ${tmp.name}\n`);
      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `OWNER: ${p.owner}\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `TICK RANGE: ${p.tickLower} -> ${p.tickUpper}\n`
      );
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `FIXED RATE RANGE: ${(1.0001 ** -p.tickUpper).toFixed(4)}% -> ${
          1.0001 ** -p.tickLower
        }%\n`
      );

      const vamm = (await hre.ethers.getContractAt(
        "VAMM",
        await tmp.marginEngine.vamm()
      )) as VAMM;

      const tick = (await vamm.vammVars()).tick;

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `CURRENT FIXED RATE ${(1.0001 ** -tick).toFixed(2)}%\n`
      );

      let positionRequirementSafety: BigNumberish = BigNumber.from(0);
      let positionRequirementLiquidation: BigNumberish = BigNumber.from(0);
      try {
        positionRequirementSafety =
          await tmp.marginEngine.callStatic.getPositionMarginRequirement(
            p.owner,
            p.tickLower,
            p.tickUpper,
            false
          );

        positionRequirementLiquidation =
          await tmp.marginEngine.callStatic.getPositionMarginRequirement(
            p.owner,
            p.tickLower,
            p.tickUpper,
            true
          );
      } catch (_) {}

      const positionInfo = await tmp.marginEngine.callStatic.getPosition(
        p.owner,
        p.tickLower,
        p.tickUpper
      );

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `FIXED TOKENS: ${ethers.utils.formatUnits(
          positionInfo.fixedTokenBalance,
          tmp.decimals
        )}, VARIABLE TOKENS: ${ethers.utils.formatUnits(
          positionInfo.variableTokenBalance,
          tmp.decimals
        )},\n`
      );

      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `MARGIN: ${ethers.utils.formatUnits(
          positionInfo.margin,
          tmp.decimals
        )}, LIQUIDATION: ${ethers.utils.formatUnits(
          positionRequirementLiquidation,
          tmp.decimals
        )}, SAFETY: ${ethers.utils.formatUnits(
          positionRequirementSafety,
          tmp.decimals
        )}\n`
      );

      const history = new PositionHistory(
        `${p.marginEngine.toLowerCase()}#${p.owner.toLowerCase()}#${
          p.tickLower
        }#${p.tickUpper}`,
        p.tickLower,
        p.tickUpper,
        tmp.decimals
      );

      await history.getInfo();

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `${history.mints.length} MINTS: \n`
      );
      for (const item of history.mints) {
        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          `${item.timestamp} (${new Date(
            item.timestamp * 1000
          ).toISOString()}): +${(item.notional + 0.00005).toFixed(
            4
          )} (tx: etherscan.io/tx/${item.transaction})\n`
        );
      }

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `${history.burns.length} BURNS: \n`
      );
      for (const item of history.burns) {
        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          `${item.timestamp} (${new Date(
            item.timestamp * 1000
          ).toISOString()}): -${(item.notional + 0.00005).toFixed(
            4
          )} (tx: etherscan.io/tx/${item.transaction})\n`
        );
      }

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `${history.swaps.length} SWAPS: \n`
      );
      for (let it_swaps = 0; it_swaps < history.swaps.length; it_swaps += 1) {
        const item = history.swaps[it_swaps];
        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          `${item.timestamp} (${new Date(
            item.timestamp * 1000
          ).toISOString()}): ${(item.variableTokenDelta + 0.00005).toFixed(
            4
          )} @ ${
            item.variableTokenDelta !== 0
              ? (
                  -item.unbalancedFixedTokenDelta / item.variableTokenDelta
                ).toFixed(4)
              : "-"
          }%`
        );

        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          ` paying ${(item.fees + 0.00005).toFixed(
            4
          )} fees (tx: etherscan.io/tx/${item.transaction})\n`
        );
      }

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `${history.marginUpdates.length} MARGIN UPDATES: \n`
      );
      for (const item of history.marginUpdates) {
        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          `${item.timestamp} (${new Date(
            item.timestamp * 1000
          ).toISOString()}): ${item.marginDelta.toFixed(
            4
          )} (tx: etherscan.io/tx/${item.transaction})\n`
        );
      }

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `${history.liquidations.length} LIQUIDATIONS: \n`
      );
      for (const item of history.liquidations) {
        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          `${item.timestamp} (${new Date(
            item.timestamp * 1000
          ).toISOString()}): ${item.reward.toFixed(4)} (tx: etherscan.io/tx/${
            item.transaction
          })\n`
        );
      }

      fs.appendFileSync(`${EXPORT_FOLDER}/info.txt`, `\n`);
      fs.appendFileSync(
        `${EXPORT_FOLDER}/info.txt`,
        `${history.settlements.length} SETTLEMENTS: \n`
      );
      for (const item of history.settlements) {
        fs.appendFileSync(
          `${EXPORT_FOLDER}/info.txt`,
          `${item.timestamp} (${new Date(
            item.timestamp * 1000
          ).toISOString()}): ${(item.settlementCashflow + 0.00005).toFixed(
            4
          )} (tx: etherscan.io/tx/${item.transaction})\n`
        );
      }

      if (taskArgs.healthHistory) {
        const currentBlock = await hre.ethers.provider.getBlock("latest");
        const currentBlockNumber = currentBlock.number;

        const header =
          "timestamp,block,tick,position_margin,position_requirement_liquidation,position_requirement_safety,fixed_token_balance,variable_token_balance\n";

        fs.writeFile(`${EXPORT_FOLDER}/progress.csv`, header, () => {});

        const startTimestamp = Number(
          ethers.utils.formatUnits(
            await tmp.marginEngine.termStartTimestampWad(),
            18
          )
        );
        const startBlock = await getBlockAtTimestamp(hre, startTimestamp);

        for (
          let b = startBlock + 1;
          b <= currentBlockNumber;
          b += taskArgs.blockInterval
        ) {
          const block = await hre.ethers.provider.getBlock(b);

          console.log("block:", b);

          const positionRequirementSafety =
            await tmp.marginEngine.callStatic.getPositionMarginRequirement(
              p.owner,
              p.tickLower,
              p.tickUpper,
              false,
              {
                blockTag: b,
              }
            );

          const positionRequirementLiquidation =
            await tmp.marginEngine.callStatic.getPositionMarginRequirement(
              p.owner,
              p.tickLower,
              p.tickUpper,
              true,
              {
                blockTag: b,
              }
            );

          const positionInfo = await tmp.marginEngine.callStatic.getPosition(
            p.owner,
            p.tickLower,
            p.tickUpper,
            {
              blockTag: b,
            }
          );

          const tick = (await vamm.vammVars({ blockTag: b })).tick;

          fs.appendFileSync(
            `${EXPORT_FOLDER}/progress.csv`,
            `${block.timestamp},${b},${
              1.0001 ** -tick
            }%,${ethers.utils.formatUnits(
              positionInfo.margin,
              tmp.decimals
            )},${ethers.utils.formatUnits(
              positionRequirementLiquidation,
              tmp.decimals
            )},${ethers.utils.formatUnits(
              positionRequirementSafety,
              tmp.decimals
            )},${ethers.utils.formatUnits(
              positionInfo.fixedTokenBalance,
              tmp.decimals
            )},${ethers.utils.formatUnits(
              positionInfo.variableTokenBalance,
              tmp.decimals
            )}\n`
          );
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

    let positions: Position[] = await getPositions();

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
      // console.log(tmp.marginEngine.toLowerCase());

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

    console.log("positions:", positions);
    console.log("number of positions found:", positions.length);

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

      await history.getInfo();

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
