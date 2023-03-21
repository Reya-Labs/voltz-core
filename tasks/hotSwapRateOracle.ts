import { task, types } from "hardhat/config";
import { MarginEngine, VAMM } from "../typechain";

import { getRateOracleByNameOrAddress } from "./utils/helpers";
import { getConfig } from "../deployConfig/config";

import mustache from "mustache";
import * as fs from "fs";
import path from "path";
import { getPool } from "../poolConfigs/pool-addresses/pools";
import { getSigner } from "./utils/getSigner";

interface UpgradeTemplateData {
  multisig: string;
  chainId: string;
  rateOracleUpdates: {
    marginEngineAddress: string;
    vammAddress: string;
    rateOracleAddress: string;
    lookbackWindowInSeconds: number;
    lookbackWindowInSecondsPlusOne: number;
    last: boolean; // Used to stop adding commas in JSON template
  }[];
}

function writeUpgradeTransactionsToGnosisSafeTemplate(
  data: UpgradeTemplateData
) {
  // Get external template with fetch
  try {
    const template = fs.readFileSync(
      path.join(__dirname, "templates/hotSwapRateOracle.json.mustache"),
      "utf8"
    );
    const output = mustache.render(template, data);

    const file = `./tasks/JSONs/hotSwapRateOracle.json`;
    fs.writeFileSync(file, output);
  } catch (e) {
    console.log("error:", e);
  }
}

// Description:
//   This task generates tx json to hot swap rate oracle for given pools if the --multisig flag is set;
//   otherwise, it sends the txs directly.
//
// Example:
//   ``npx hardhat hotSwapRateOracle --network mainnet --multisig --rate-oracle 0x9f30Ec6903F1728ca250f48f664e48c3f15038eD aUSDC_v9 aUSDC_v11``

task(
  "hotSwapRateOracle",
  "Change the RateOracle used by a given list of MarginEngines instances (i.e. proxies) and their corresponding VAMMs"
)
  .addVariadicPositionalParam("pools", "Comma-separated pool names")
  .addParam(
    "rateOracle",
    "The name or address of the new rate oracle that the MarginEngine (and its VAMM) should use",
    undefined,
    types.string
  )
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    // Fetch rate oracle
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    const rateOracleAddress = rateOracle.address;

    const { deployer } = await hre.getNamedAccounts();

    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    const data: UpgradeTemplateData = {
      rateOracleUpdates: [],
      multisig,
      chainId: await hre.getChainId(),
    };

    for (const poolName of taskArgs.pools) {
      const pool = getPool(hre.network.name, poolName);

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        pool.marginEngine
      )) as MarginEngine;

      const vamm = (await hre.ethers.getContractAt("VAMM", pool.vamm)) as VAMM;

      const lookbackWindowInSeconds = (
        await marginEngine.lookbackWindowInSeconds()
      ).toNumber();

      const proxyOwner = await marginEngine.owner();

      // TODO: check that rate oracle has data older than min(IRS start timestamp, current time - lookback window)

      if (taskArgs.multisig) {
        // Using multisig template instead of sending any transactions
        data.rateOracleUpdates.push({
          marginEngineAddress: pool.marginEngine,
          vammAddress: pool.vamm,
          rateOracleAddress,
          lookbackWindowInSeconds: lookbackWindowInSeconds,
          lookbackWindowInSecondsPlusOne: lookbackWindowInSeconds + 1,
          last: false,
        });
      } else {
        // Not using multisig template - actually send the transactions
        if (multisig !== proxyOwner && deployer !== proxyOwner) {
          console.log(
            `Not authorised to update MarginEngine ${pool.marginEngine} (owned by ${proxyOwner})`
          );
        } else {
          const signer = await getSigner(hre, proxyOwner);

          await marginEngine.connect(signer).setRateOracle(rateOracleAddress);

          await vamm.connect(signer).refreshRateOracle();

          await marginEngine
            .connect(signer)
            .setLookbackWindowInSeconds(lookbackWindowInSeconds);
        }
        console.log(
          `MarginEngine (${pool.marginEngine}) and VAMM (${pool.vamm}) updated to point at latest ${taskArgs.rateOracle} (${rateOracleAddress})`
        );
      }
    }

    if (taskArgs.multisig && data.rateOracleUpdates.length > 0) {
      data.rateOracleUpdates[data.rateOracleUpdates.length - 1].last = true;
      writeUpgradeTransactionsToGnosisSafeTemplate(data);
    }
  });

module.exports = {};
