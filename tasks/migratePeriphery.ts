import { task } from "hardhat/config";
import { Factory, Periphery, PeripheryOld } from "../typechain";
import "@openzeppelin/hardhat-upgrades";

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

task("migratePeriphery", "Deploy and set up upgradable periphery")
  .addParam("oldPeripheryAddress", "Old address")
  .addParam("peripheryProxyAddress", "periphery Proxy address")
  .addParam("factoryAddress", "Factory address")
  .addParam("vamms", "List of VAMMS addresses")
  .setAction(async (taskArgs, hre) => {
    const oldPeriphery = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.oldPeripheryAddress
    )) as Periphery;

    const peripheryProxy = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.peripheryProxyAddress
    )) as Periphery;

    const vamms = taskArgs.vamms;
    const vammAddreses = vamms.split(",");
    for (const vammAddress of vammAddreses) {
      const lpMarginCumulative = await oldPeriphery.lpMarginCumulatives(
        vammAddress
      );
      const lpMarginCap = await oldPeriphery.lpMarginCaps(vammAddress);

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
    }

    // set the periphery in the factory
    const factoryAddress = taskArgs.factoryAddress;

    const factory = (await hre.ethers.getContractAt(
      "Factory",
      factoryAddress
    )) as Factory;

    const trx = await factory.setPeriphery(peripheryProxy.address, {
      gasLimit: 10000000,
    });
    await trx.wait();

    const peripheryAddressInFactory = await factory.periphery();
    console.log("Periphery address in factory: ", peripheryAddressInFactory);
  });

module.exports = {};
