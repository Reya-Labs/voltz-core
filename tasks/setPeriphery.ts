import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { getConfig } from "../deployConfig/config";

const Confirm = require("prompt-confirm");

interface MultisigTemplateData {
  peripheryAddress: string;
  factoryAddress: string;
  multisig: string;
  chainId: string;
}

// Description:
//   This task generates a tx json for multisig to set new periphery in factory
//   if the --multisig flag is set. Otherwise, it executes the transaction.
//
// Example:
//   ``npx hardhat setPeriphery --network mainnet --periphery-proxy 0x07ceD903E6ad0278CC32bC83a3fC97112F763722 --multisig``

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  const fs = require("fs");

  const template = fs.readFileSync(
    path.join(__dirname, "templates/setPeriphery.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const jsonDir = path.join(__dirname, "JSONs");
  const outFile = path.join(jsonDir, "setPeriphery.json");

  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
  }

  fs.writeFileSync(outFile, output);

  console.log("Output written to ", outFile.toString());
}

task("setPeriphery", "Sets the periphery")
  .addParam("peripheryProxy", "The address of the Periphery proxy contract")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    // Get task arguments
    const peripheryAddress = taskArgs.peripheryProxy; // proxy

    // Fetch factory
    const factory = await hre.ethers.getContract("Factory");

    // Get deployer address
    const { deployer } = await hre.getNamedAccounts();

    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    if (taskArgs.multisig) {
      const template: MultisigTemplateData = {
        peripheryAddress: peripheryAddress,
        factoryAddress: factory.address,
        multisig: multisig,
        chainId: await hre.getChainId(),
      };

      writeUpdateTransactionsToGnosisSafeTemplate(template);
    } else {
      const prompt = new Confirm(
        `Are you sure that you want to set the periphery of ${factory.address} to ${peripheryAddress} from ${deployer} on ${network}?`
      );

      const response = await prompt.run();

      if (!response) {
        console.log("Rejected");
        return;
      }

      const trx = await factory.setPeriphery(peripheryAddress, {
        gasLimit: 10000000,
      });
      await trx.wait();
    }
  });

module.exports = {};
