import { task } from "hardhat/config";
import { IERC20Minimal, MarginEngine, Periphery } from "../../typechain";
import path from "path";
import mustache from "mustache";

import "@nomiclabs/hardhat-ethers";
import { getNetworkPools } from "../../poolConfigs/pool-addresses/pools";

type MintOrBurnParams = {
  pool: string;
  tickLower: number;
  tickUpper: number;
  notional: number;
  isMint: boolean;
  marginDelta: number;
};

type MultisigTemplate = {
  periphery: string;
  mints: {
    marginEngine: string;
    token: string;
    tickLower: number;
    tickUpper: number;
    notional: string;
    isMint: boolean;
    marginDelta: string;
    last: boolean;
  }[];
};

async function writeToMultisigTemplate(data: MultisigTemplate) {
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "../templates/mints.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/mints.json`;
  fs.writeFileSync(file, output);
}

const mints: MintOrBurnParams[] = [
  {
    pool: "glpETH_v2",
    tickLower: -38040,
    tickUpper: -23040,
    notional: 3000,
    isMint: true,
    marginDelta: 60,
  },
];

task("mintLiquidity", "Mints liquidity").setAction(async (_, hre) => {
  const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

  const poolAddresses = getNetworkPools(hre.network.name);

  const data: MultisigTemplate = {
    periphery: periphery.address,
    mints: [],
  };

  for (const mint of mints) {
    const tmp = poolAddresses[mint.pool as keyof typeof poolAddresses];

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      tmp.marginEngine
    )) as MarginEngine;
    const tokenAddress = await marginEngine.underlyingToken();
    const token = (await hre.ethers.getContractAt(
      "IERC20Minimal",
      tokenAddress
    )) as IERC20Minimal;
    const decimals = await token.decimals();

    data.mints.push({
      marginEngine: tmp.marginEngine,
      token: token.address,
      tickLower: mint.tickLower,
      tickUpper: mint.tickUpper,
      notional: hre.ethers.utils
        .parseUnits(mint.notional.toString(), decimals)
        .toString(),
      isMint: mint.isMint,
      marginDelta: hre.ethers.utils
        .parseUnits(mint.marginDelta.toString(), decimals)
        .toString(),
      last: false,
    });
  }

  data.mints[data.mints.length - 1].last = true;

  await writeToMultisigTemplate(data);
});

module.exports = {};
