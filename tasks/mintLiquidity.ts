import { task } from "hardhat/config";
import { IERC20Minimal, MarginEngine, Periphery } from "../typechain";
import * as poolAddresses from "../pool-addresses/mainnet.json";
import path from "path";
import mustache from "mustache";

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
    path.join(__dirname, "templates/mints.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/mints.json`;
  fs.writeFileSync(file, output);
}

const mints: MintOrBurnParams[] = [
  {
    pool: "aUSDC_v8",
    tickLower: -13920,
    tickUpper: 0,
    notional: 10000000,
    isMint: true,
    marginDelta: 100000,
  },
];

// TODO: to be added: tx execution and simulation
task("mintLiquidity", "Mints liquidity").setAction(async (_, hre) => {
  const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

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
