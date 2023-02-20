import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";

interface MultisigTemplateData {
  data: {
    peripheryAddress: string;
    factoryAddress: string;
  };
}

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
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
  .addParam("factoryAddress", "The address of the Factory contract")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    const peripheryAddress = taskArgs.peripheryProxy; // proxy
    const factoryAddress = taskArgs.factoryAddress;

    if (taskArgs.multisig) {
      const template: MultisigTemplateData = {
        data: {
          peripheryAddress: peripheryAddress,
          factoryAddress: factoryAddress,
        },
      };
      writeUpdateTransactionsToGnosisSafeTemplate(template);
    } else {
      const factory = await hre.ethers.getContract("Factory");

      // set the periphery in the factory
      const trx = await factory.setPeriphery(peripheryAddress, {
        gasLimit: 10000000,
      });
      await trx.wait();
    }
  });

module.exports = {};
