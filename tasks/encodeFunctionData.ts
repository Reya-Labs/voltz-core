import { task } from "hardhat/config";

task("encodeFunctionData", "Check positions").setAction(async (_, hre) => {
  const address = "";
  const periphery = await hre.ethers.getContractAt("Periphery", address);

  //   const tx = periphery.interface.encodeFunctionData("updatePositionMargin", [
  //     "0xb1125ba5878cf3a843be686c6c2486306f03e301",
  //     -20820,
  //     0,
  //     "-830000000000000000000",
  //     false,
  //   ]);

  //   const tx = periphery.interface.encodeFunctionData("updatePositionMargin", [
  //     "0x21f9151d6e06f834751b614c2ff40fc28811b235",
  //     -16080,
  //     6960,
  //     "-685000000000000000000",
  //     false,
  //   ]);

  const tx =
    "0x32e00daf00000000000000000000000021f9151d6e06f834751b614c2ff40fc28811b235ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc1300000000000000000000000000000000000000000000000000000000000001b300000000000000000000000000000000000000000000001e7e4171bf4d3a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const result = periphery.interface.parseTransaction({ data: tx });

  console.log("tx:", tx);
  console.log("args:", result.args[0].marginDelta.toString());
});

module.exports = {};
