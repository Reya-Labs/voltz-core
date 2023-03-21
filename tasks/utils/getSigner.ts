import { HardhatRuntimeEnvironment } from "hardhat/types";

async function impersonateAccount(
  hre: HardhatRuntimeEnvironment,
  acctAddress: string
) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  // It might be a multisig contract, in which case we also need to pretend it has money for gas
  await hre.ethers.provider.send("hardhat_setBalance", [
    acctAddress,
    "0x10000000000000000000",
  ]);
}

export async function getSigner(
  hre: HardhatRuntimeEnvironment,
  acctAddress: string
) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    // We can impersonate the account
    await impersonateAccount(hre, acctAddress);
  }
  return await hre.ethers.getSigner(acctAddress);
}
