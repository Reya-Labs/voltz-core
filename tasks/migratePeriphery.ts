import { task } from "hardhat/config";
import { Factory, Periphery, PeripheryOld } from "../typechain";
import { BigNumber } from "ethers";
import "@openzeppelin/hardhat-upgrades";
import path from "path";
import * as fs from "fs";
import mustache from "mustache";

interface MigrateTemplateData {
  vammMigrations: {
    peripheryAddress: string;
    vammAddress: string;
    lpMarginCumulative: BigNumber;
    lpMarginCap: BigNumber;
  }[];
  factoryAddress: string;
  peripheryAddress: string;
  weth: string;
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

// npx hardhat --network localhost migratePeriphery --old-periphery-address 0xf5059a5D33d5853360D16C683c16e67980206f36 --periphery-proxy-address 0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf --factory-address 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0 --vamms 0xE451980132E65465d0a498c53f0b5227326Dd73F,0xB30dAf0240261Be564Cea33260F01213c47AAa0D
task("migratePeriphery", "Set up upgradable periphery")
  .addParam("oldPeripheryAddress", "Old address")
  .addParam("peripheryProxyAddress", "periphery Proxy address")
  .addParam("factoryAddress", "Factory address")
  .addParam("vamms", "List of VAMMS addresses")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    const data: MigrateTemplateData = {
      vammMigrations: [],
      factoryAddress: "",
      peripheryAddress: "",
      weth: "",
    };

    const oldPeriphery = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.oldPeripheryAddress
    )) as Periphery;

    const peripheryProxy = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.peripheryProxyAddress
    )) as Periphery;

    // set WETH address

    const weth = await oldPeriphery._weth();
    if (!taskArgs.multisig) {
      const tx_weth = await peripheryProxy.setWeth(weth);
      await tx_weth.wait();
    } else {
      data.weth = weth;
    }

    // set VAMM margin cap values

    const vamms = taskArgs.vamms;
    const vammAddreses = vamms.split(",");
    for (const vammAddress of vammAddreses) {
      const lpMarginCumulative = await oldPeriphery.lpMarginCumulatives(
        vammAddress
      );
      const lpMarginCap = await oldPeriphery.lpMarginCaps(vammAddress);

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
        data.vammMigrations.push({
          peripheryAddress: peripheryProxy.address,
          vammAddress: vammAddress,
          lpMarginCumulative: lpMarginCumulative,
          lpMarginCap: lpMarginCap,
        });
      }
    }

    // set the periphery in the Factory

    const factoryAddress = taskArgs.factoryAddress;
    const factory = (await hre.ethers.getContractAt(
      "Factory",
      factoryAddress
    )) as Factory;

    if (!taskArgs.multisig) {
      const trx = await factory.setPeriphery(peripheryProxy.address, {
        gasLimit: 10000000,
      });
      await trx.wait();

      const peripheryAddressInFactory = await factory.periphery();
      console.log("Periphery address in factory: ", peripheryAddressInFactory);
    } else {
      data.factoryAddress = factory.address;
      data.peripheryAddress = peripheryProxy.address;
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

    const vamms =
      "0xE451980132E65465d0a498c53f0b5227326Dd73F,0xB30dAf0240261Be564Cea33260F01213c47AAa0D"; /// /
    const vammAddreses = vamms.split(",");
    for (const vammAddress of vammAddreses) {
      let tx = await oldPeriphery.setLPMarginCumulative(vammAddress, 1000);
      await tx.wait();
      tx = await oldPeriphery.setLPMarginCap(vammAddress, 2000);
      await tx.wait();

      console.log(vammAddress);

      const lpMarginCumulative2 = await oldPeriphery._lpMarginCumulatives(
        vammAddress
      );
      const lpMarginCap2 = await oldPeriphery._lpMarginCaps(vammAddress);

      console.log("Margin Cumulative: ", lpMarginCumulative2.toString());
      console.log("Margin Cap: ", lpMarginCap2.toString());
    }
  });

module.exports = {};
