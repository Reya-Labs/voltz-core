import { task, types } from "hardhat/config";
import { getConfig } from "../deployConfig/config";
import { toBn } from "../test/helpers/toBn";
import {
  MarginEngine,
  VAMM,
  Factory,
  IMarginEngine,
  IVAMM,
  VoltzERC1967Proxy,
  UUPSUpgradeable,
} from "../typechain";
import { BigNumberish, ethers, utils } from "ethers";
import {
  getIRSByMarginEngineAddress,
  getRateOracleByNameOrAddress,
} from "./helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IrsConfigDefaults } from "../deployConfig/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";

const _ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
interface MultisigTemplateData {
  factoryAddress: string;
  predictedMarginEngineAddress: string;
  predictedVammAddress: string;
  peripheryAddress: string;
  underlyingTokenAddress: string;
  rateOracleAddress: string;
  termStartTimestampWad: BigNumberish;
  termEndTimestampWad: BigNumberish;
  tickSpacing: number;
}

async function writeIrsCreationTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const template = fs.readFileSync(
    path.join(__dirname, "UpgradeIrs.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  console.log("Output:\n", output);
}

async function getImplementationAddress(
  hre: HardhatRuntimeEnvironment,
  proxyAddress: string
) {
  const implHex = await hre.ethers.provider.getStorageAt(
    proxyAddress,
    _ERC1967_IMPLEMENTATION_SLOT
  );
  return ethers.utils.getAddress(hre.ethers.utils.hexStripZeros(implHex));
}

async function getSigner(hre: HardhatRuntimeEnvironment, acctAddress: string) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    // We can impersonate the account
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
  return await hre.ethers.getSigner(acctAddress);
}

task(
  "upgradeVAMM",
  "Upgrades an instance of a VAMM to the latest deployed VAMM code"
)
  .addParam("vamm", "The address of the VAMM proxy")
  .setAction(async (taskArgs, hre) => {
    const vammProxy = (await hre.ethers.getContractAt(
      "VAMM",
      taskArgs.vamm
    )) as VAMM;
    const proxyAddress = vammProxy.address;
    const latestVammLogicAddress = (await hre.ethers.getContract("VAMM"))
      .address;
    const initImplAddress = await getImplementationAddress(hre, proxyAddress);
    const proxyOwner = await vammProxy.owner();

    const { deployer } = await hre.getNamedAccounts();
    console.log(
      `Upgrading to ${latestVammLogicAddress} from account ${deployer}`
    );
    if (initImplAddress === latestVammLogicAddress) {
      console.log(
        `The VAMM at ${proxyAddress} is using the latest logic (${latestVammLogicAddress}). No newer logic deployed!`
      );
      console.log;
    } else if (deployer !== proxyOwner) {
      console.log(
        `Account ${deployer} is not authorised to upgrade the proxy at ${proxyAddress}`
      );
    } else {
      await vammProxy
        .connect(await getSigner(hre, deployer))
        .upgradeTo(latestVammLogicAddress);
      const newImplAddress = await getImplementationAddress(hre, proxyAddress);
      console.log(
        `VAMM at ${vammProxy.address} has been upgraded from implementation ${initImplAddress} to ${newImplAddress}`
      );
    }
  });

module.exports = {};
