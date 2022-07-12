import { task } from "hardhat/config";
import { VAMM } from "../typechain";
import { ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";

const _ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
interface UpgradeTemplateData {
  proxyUpgrades: { proxyAddress: string; newImplementation: string }[];
}

async function writeUpgradeTransactionsToGnosisSafeTemplate(
  data: UpgradeTemplateData
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

async function getSigner(hre: HardhatRuntimeEnvironment, acctAddress: string) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    // We can impersonate the account
    await impersonateAccount(hre, acctAddress);
  }
  return await hre.ethers.getSigner(acctAddress);
}

// TODO: make this task a generic upgrade task, that can upgrade any or all of vamm, marginEngine, fcms and periphery
task(
  "deployUpdatedVAMM",
  "Deploys a new instance of the MasterVAMM (the logic contract used by VAMM instances)"
).setAction(async (taskArgs, hre) => {
  const currentMasterVamm = (await hre.ethers.getContract("VAMM")).address;
  // Path of JSON artifacts for deployed (not compiled) contracts, relative to this tasks directory
  const deployedArtifactsDir = path.join(
    __dirname,
    "..",
    "deployments",
    hre.network.name
  );

  // Take a backup of the most recently deployed VAMM.json file before we overwrite it
  const deployedVammArtifact = path.join(deployedArtifactsDir, "VAMM.json");
  // const archiveDir = path.join(deployedArtifactsDir, "history");
  // await fs.mkdirSync(archiveDir);
  const renameTo = path.join(
    deployedArtifactsDir,
    `VAMM.${currentMasterVamm}.json`
  );
  fs.copyFileSync(deployedVammArtifact, renameTo);

  const { deployer } = await hre.getNamedAccounts();
  // Impersonation does not work with the multisig account (it should; see https://github.com/wighawag/hardhat-deploy/issues/152) so we use deployer
  const deployResult = await hre.deployments.deploy("VAMM", {
    from: deployer,
    log: true,
    skipIfAlreadyDeployed: false,
  });
  if (deployResult.newlyDeployed) {
    console.log(
      `contract VAMM deployed at ${deployResult.address} using ${deployResult.receipt?.gasUsed} gas`
    );
  } else {
    console.log("VAMM has not changed - no need to redeploy.");
  }
});

// TODO: add marginEngine, aaveFcm, compoundFcm and periphery params/flags, and do all in one go
task(
  "upgradeVAMM",
  "Upgrades VAMM instances (i.e. proxies) to use the latest deployed VAMM implementation logic"
)
  .addParam(
    "vamms",
    "Comma-separated list of addresses of the VAMM proxies that we wish to upgrade"
  )
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    // Some prep work before we loop through the VAMMs
    const latestVammLogicAddress = (await hre.ethers.getContract("VAMM"))
      .address;
    const { deployer, multisig } = await hre.getNamedAccounts();
    const data: UpgradeTemplateData = { proxyUpgrades: [] };
    const vamms = taskArgs.vamms.split(",");

    // Now loop through all the VAMMs we want to upgrade
    for (const vamm of vamms) {
      const vammProxy = (await hre.ethers.getContractAt("VAMM", vamm)) as VAMM;
      const proxyAddress = vammProxy.address;
      const initImplAddress = await getImplementationAddress(hre, proxyAddress);
      const proxyOwner = await vammProxy.owner();

      if (initImplAddress === latestVammLogicAddress) {
        console.log(
          `The VAMM at ${proxyAddress} is using the latest logic (${latestVammLogicAddress}). No newer logic deployed!`
        );
      } else {
        if (taskArgs.multisig) {
          // Using multisig template instead of sending any transactions
          data.proxyUpgrades.push({
            proxyAddress: vammProxy.address,
            newImplementation: latestVammLogicAddress,
          });
        } else {
          // Not using multisig template - actually send the transactions
          if (multisig !== proxyOwner && deployer !== proxyOwner) {
            console.log(
              `Not authorised to upgrade the proxy at ${proxyAddress} (owned by ${proxyOwner})`
            );
          } else {
            await vammProxy
              .connect(await getSigner(hre, proxyOwner))
              .upgradeTo(latestVammLogicAddress);
            const newImplAddress = await getImplementationAddress(
              hre,
              proxyAddress
            );
            console.log(
              `VAMM at ${vammProxy.address} has been upgraded from implementation ${initImplAddress} to ${newImplAddress}`
            );
          }
        }
      }
    }

    if (taskArgs.multisig) {
      writeUpgradeTransactionsToGnosisSafeTemplate(data);
    }
  });

module.exports = {};
