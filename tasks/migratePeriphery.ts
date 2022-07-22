import { task } from "hardhat/config";
import { Factory, Periphery, PeripheryOld } from "../typechain";
import { BigNumber } from "ethers";
import "@openzeppelin/hardhat-upgrades";
import path from "path";
import * as fs from "fs";
import mustache from "mustache";
import { getIrsInstanceEvents } from "./helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface MigrateTemplateData {
  migration: {
    vammMigrations: {
      vammAddress: string;
      lpMarginCumulative: BigNumber;
      lpMarginCap: BigNumber;
    }[];
    factoryAddress: string;
    peripheryAddress: string;
  };
}

async function writePeripheryMigrationTrxToGnosisSafeTemplate(
  data: MigrateTemplateData
) {
  // Get external template with fetch
  const template = fs.readFileSync(
    path.join(__dirname, "PeripheryMigration.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  console.log("\n", output);
}

task("migratePeriphery", "Set up upgradable periphery")
  .addParam("oldPeripheryAddress", "Old address")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    const data: MigrateTemplateData = {
      migration: {
        vammMigrations: [],
        factoryAddress: "",
        peripheryAddress: "",
      },
    };

    const oldPeriphery = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.oldPeripheryAddress
    )) as Periphery;

    const peripheryProxy = await hre.ethers.getContract("Periphery");

    // set VAMM margin cap values

    const vammAddreses = await listVammInstances(hre);
    for (const vammAddress of vammAddreses) {
      console.log("Set margin vars for VAMM at address ", vammAddress);
      const lpMarginCumulative = await oldPeriphery.lpMarginCumulatives(
        vammAddress
      );
      const lpMarginCap = await oldPeriphery.lpMarginCaps(vammAddress);

      if (lpMarginCumulative.eq(0) && lpMarginCap.eq(0)) {
        continue;
      }

      if (!taskArgs.multisig) {
        let tx = await peripheryProxy.setLPMarginCumulative(
          vammAddress,
          lpMarginCumulative
        );
        await tx.wait();
        tx = await peripheryProxy.setLPMarginCap(vammAddress, lpMarginCap);
        await tx.wait();

        const lpMarginCumulative2 = await peripheryProxy.lpMarginCumulatives(
          vammAddress
        );
        const lpMarginCap2 = await peripheryProxy.lpMarginCaps(vammAddress);

        console.log("Margin Cumulative: ", lpMarginCumulative2.toString());
        console.log("Margin Cap: ", lpMarginCap2.toString());
      } else {
        data.migration.vammMigrations.push({
          vammAddress: vammAddress,
          lpMarginCumulative: lpMarginCumulative,
          lpMarginCap: lpMarginCap,
        });
      }
    }

    // set the periphery in the Factory

    const factory = (await hre.ethers.getContract("Factory")) as Factory;

    if (!taskArgs.multisig) {
      const trx = await factory.setPeriphery(peripheryProxy.address, {
        gasLimit: 10000000,
      });
      await trx.wait();

      const peripheryAddressInFactory = await factory.periphery();
      console.log("Periphery address in factory: ", peripheryAddressInFactory);
    } else {
      data.migration.factoryAddress = factory.address;
      data.migration.peripheryAddress = peripheryProxy.address;
      writePeripheryMigrationTrxToGnosisSafeTemplate(data);
    }
  });

// used for testing
task(
  "setUpDummyPeriphery",
  "Setting the lp margin vars in the already existing periphery"
)
  .addParam("oldPeripheryAddress", "Old address")
  .setAction(async (taskArgs, hre) => {
    const oldPeriphery = (await hre.ethers.getContractAt(
      "PeripheryOld",
      taskArgs.oldPeripheryAddress
    )) as PeripheryOld;

    const vammAddreses = await listVammInstances(hre);
    for (const vammAddress of vammAddreses) {
      let tx = await oldPeriphery.setLPMarginCumulative(vammAddress, 1000);
      await tx.wait();
      tx = await oldPeriphery.setLPMarginCap(vammAddress, 2000);
      await tx.wait();

      console.log(vammAddress);

      const lpMarginCumulative2 = await oldPeriphery.lpMarginCumulatives(
        vammAddress
      );
      const lpMarginCap2 = await oldPeriphery.lpMarginCaps(vammAddress);

      console.log("Margin Cumulative: ", lpMarginCumulative2.toString());
      console.log("Margin Cap: ", lpMarginCap2.toString());
    }
  });

async function listVammInstances(hre: HardhatRuntimeEnvironment) {
  const events = await getIrsInstanceEvents(hre);
  let list = "";

  for (const e of events) {
    const a = e.args;
    list += a.vamm;
    list += ",";
  }
  list = list.slice(0, -1);

  return list.split(",");
}

module.exports = {};
