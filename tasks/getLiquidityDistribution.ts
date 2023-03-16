import { task } from "hardhat/config";

import "@nomiclabs/hardhat-ethers";
import { getPositions, Position } from "../scripts/getPositions";

import { utils } from "ethers";
import { pools } from "../poolConfigs/pool-addresses/pools";

task("getLiquidityDistribution", "Retrieves the liquidity distribution")
  .addParam(
    "pools",
    "Comma-separated pool names as in pool-addresses/mainnet.json"
  )
  .setAction(async (taskArgs, hre) => {
    const positions: Position[] = await getPositions(
      hre.network.name,
      Math.floor(Date.now() / 1000)
    );

    const poolNames: string[] = taskArgs.pools.split(",");
    const poolAddresses = pools.mainnet;

    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      const tmp = poolAddresses[p as keyof typeof poolAddresses];

      if (!tmp) {
        throw new Error(`Pool ${p} doesnt's exist.`);
      }

      const mePositions = positions.filter(
        (p) => p.marginEngine.toLowerCase() === tmp.marginEngine.toLowerCase()
      );

      const liquidityMap = new Map<string, number>();
      for (const pos of mePositions) {
        const liquidity =
          parseFloat(utils.formatUnits(pos.liquidity, tmp.decimals)) *
          (1.0001 ** (pos.tickUpper / 2) - 1.0001 ** (pos.tickLower / 2));

        liquidityMap.set(
          pos.owner,
          (liquidityMap.get(pos.owner) || 0) + liquidity
        );
      }

      const entries: [string, number][] = [];
      for (const e of liquidityMap.entries()) {
        entries.push(e);
      }

      entries.sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((acc, curr) => acc + curr[1], 0);

      console.log(`Pool: ${p}`);
      console.log(`Total: ${(total + 0.005).toFixed(2)}`);
      console.log("Top LPs:");
      entries.slice(0, 3).forEach(([owner, liq]) => {
        console.log(
          `owner: ${owner}: liquidity: ${(liq + 0.005).toFixed(2)} (${(
            (liq / total) * 100 +
            0.005
          ).toFixed(2)}%)`
        );
      });

      console.log();
    }
  });

module.exports = {};
