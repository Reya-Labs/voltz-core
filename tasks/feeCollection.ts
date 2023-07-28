import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { getConfig } from "../deployConfig/config";
import { getPool } from "../poolConfigs/pool-addresses/pools";
import { FeeCollector, MarginEngine, VAMM } from "../typechain";

interface MultisigTemplateData {
  poolsCollection: {
    marginEngineAddress: string;
    amount: string;
  }[];
  feeCollectorAddress: string;
  distributeAssets: boolean;
  collectDefaultFund: boolean;
  collectProtocolFees: boolean;
  assets: string[];
  multisig: string;
  chainId: string;
}

function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "templates/collectFees.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `tasks/JSONs/collectFees.json`;
  fs.writeFileSync(file, output);
}

// Description:
//   This task generates mutiple fee collection transactions
//   if the --multisig flag is set. Otherwise, it executes the transaction.
//
// Example:
//   ``npx hardhat collectFees --network mainnet --collect --distribute --transfer-protocol-fee --transfer-default-fund --multisig aUSDC_v1 aUSDC_v2``
//
task("collectFees", "Executes actions for fee collection by the protocol owner")
  .addFlag("collect", "Triggers collection from Margin Engine to Fee Collector")
  .addFlag(
    "distribute",
    "Triggers distribution of fees into default fund and protocol fees"
  )
  .addFlag("transferProtocolFee", "Triggers transfer of protocol fee to owner")
  .addFlag("transferDefaultFund", "Triggers transfer of default fund to owner")
  .addVariadicPositionalParam("pools", "Comma-separated pool names")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;

    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);

    const data: MultisigTemplateData = {
      poolsCollection: [],
      distributeAssets: false,
      collectDefaultFund: false,
      collectProtocolFees: false,
      assets: [],
      feeCollectorAddress: "",
      multisig: "",
      chainId: "",
    };

    const feeCollector = (await hre.ethers.getContract(
      "FeeCollector"
    )) as FeeCollector;
    const feeCollectorAddress = feeCollector.address;
    data.feeCollectorAddress = feeCollectorAddress;

    // Iterate through the given pools and add them to the keeper
    const assetsList: string[] = [];
    for (const poolName of poolNames) {
      const pool = getPool(network, poolName);

      const amount = await (
        (await hre.ethers.getContractAt("VAMM", pool.vamm)) as VAMM
      ).protocolFees();

      const poolCollection = {
        marginEngineAddress: pool.marginEngine,
        amount: amount.toString(),
      };

      data.poolsCollection.push(poolCollection);

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        pool.marginEngine
      )) as MarginEngine;
      const assetAddress = (await marginEngine.underlyingToken()).toLowerCase();
      if (assetsList.indexOf(assetAddress) !== -1) {
        assetsList.push(assetAddress);
      }
    }

    /// note: can be extended to customize assets list
    data.assets = assetsList;

    if (taskArgs.multisig) {
      const multisig = deployConfig.multisig;
      data.multisig = multisig;
      data.chainId = await hre.getChainId();
      writeUpdateTransactionsToGnosisSafeTemplate(data);
    } else {
      for (const poolCollection of data.poolsCollection) {
        const marginEngine = (await hre.ethers.getContractAt(
          "MarginEngine",
          poolCollection.marginEngineAddress
        )) as MarginEngine;
        const tx = await marginEngine.collectProtocol(
          data.feeCollectorAddress,
          poolCollection.amount,
          {
            gasLimit: 10000000,
          }
        );
        await tx.wait();
      }

      if (data.distributeAssets) {
        const tx = await feeCollector.distributeAllFees(data.assets, {
          gasLimit: 10000000,
        });
        await tx.wait();
      }

      if (data.collectDefaultFund) {
        const tx = await feeCollector.collectAllFees(data.assets, true, {
          gasLimit: 10000000,
        });
        await tx.wait();
      }

      if (data.collectProtocolFees) {
        const tx = await feeCollector.collectAllFees(data.assets, false, {
          gasLimit: 10000000,
        });
        await tx.wait();
      }
    }
  });
