import { task, types } from "hardhat/config";
import { MarginEngine, VAMM } from "../typechain";
import { BigNumber, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";
import { getRateOracleByNameOrAddress } from "./helpers";

const _ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
interface UpgradeTemplateData {
  proxyUpgrades: { proxyAddress: string; newImplementation: string }[];
  rateOracleUpdates: {
    marginEngineAddress: string;
    vammAddress: string;
    rateOracleAddress: string;
    lookbackWindowInSeconds: BigNumber;
  }[];
}

const proxiedContractTypes = [
  "VAMM",
  "MarginEngine",
  "Periphery",
  "AaveFCM",
  "CompoundFCM",
];
const proxiedContractTypesAsString = proxiedContractTypes
  .map((c) => `"${c}"`)
  .join(", ");

async function writeUpgradeTransactionsToGnosisSafeTemplate(
  data: UpgradeTemplateData
) {
  // Get external template with fetch
  const template = fs.readFileSync(
    path.join(__dirname, "UpgradeIrs.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  console.log("\n", output);
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
// TODO: (optionally) update factory state to point at new instances
task(
  "deployUpdatedImplementations",
  `Deploys a new instance of the logic contract used by instances of the following contracts ${proxiedContractTypesAsString}`
)
  .addParam(
    "contractNames",
    `Comma-separated list of one or more contract types for which we wish to deploy a new implementation. Choose from ${proxiedContractTypesAsString}.`,
    undefined,
    types.string
  )
  // TODO: generate transactions to update factory
  // .addFlag(
  //   "factory",
  //   "If set, the task will update the factory's references to all updated contracts"
  // )
  // .addFlag(
  //   "multisig",
  //   "If set, the --factory flag will produce a JSON file for use in a multisig, instead of sending transactions on chain"
  // )
  .setAction(async (taskArgs, hre) => {
    const contractNames = taskArgs.contractNames.split(",");
    for (const contractName of contractNames) {
      if (!proxiedContractTypes.includes(contractName)) {
        throw Error(`Unsupported contract type: ${contractName}`);
      }
    }

    for (const contractName of contractNames) {
      const currentImplAddress = (await hre.ethers.getContract(contractName))
        .address;
      // Path of JSON artifacts for deployed (not compiled) contracts, relative to this tasks directory
      const deployedArtifactsDir = path.join(
        __dirname,
        "..",
        "deployments",
        hre.network.name
      );

      // TODO: compare storage layouts and warn/abort if not compatible

      // Take a backup of the most recently deployed artifact file before we overwrite it
      const deployedArtifact = path.join(
        deployedArtifactsDir,
        `${contractName}.json`
      );

      // We use an archive directory to store details of every previous implementation
      const archiveDir = path.join(deployedArtifactsDir, "history");
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      // Copy the file into the archive directory. If deployment fails it should also stay in the main folder.
      const renameTo = path.join(
        archiveDir,
        `${contractName}.${currentImplAddress}.json`
      );
      fs.copyFileSync(deployedArtifact, renameTo);

      // Impersonation does not work with the multisig account (it should; see https://github.com/wighawag/hardhat-deploy/issues/152) so we use deployer
      const { deployer } = await hre.getNamedAccounts();
      const deployResult = await hre.deployments.deploy(contractName, {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: false,
      });
      if (deployResult.newlyDeployed) {
        console.log(
          `contract ${contractName} deployed at ${deployResult.address} using ${deployResult.receipt?.gasUsed} gas`
        );
      } else {
        console.log(`${contractName} has not changed - no need to redeploy.`);
      }
    }
  });

// TODO: add marginEngine, aaveFcm, compoundFcm and periphery params/flags, and do all in one go
task(
  "upgradeVAMM",
  "Upgrades VAMM instances (i.e. proxies) to use the latest deployed VAMM implementation logic"
)
  .addParam(
    "vamms",
    "Comma-separated list of addresses of the VAMM proxies that we wish to upgrade",
    undefined,
    types.string
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
    const data: UpgradeTemplateData = {
      rateOracleUpdates: [],
      proxyUpgrades: [],
    };
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
        // TODO: compare storage layouts and abort upgrade if not compatible

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

task(
  "updateRateOracle",
  "Change the RateOracle used by a given list of MarginEngines instances (i.e. proxies) and their corresponding VAMMs"
)
  .addParam(
    "marginEngines",
    "Comma-separated list of addresses of the MarginEngine proxies for which we wish to change the Rate Oracle (associated VAMMs will update too)",
    undefined,
    types.string
  )
  .addParam(
    "rateOracle",
    "The name or address of the new rate oracle that the MarginEngine (and its VAMM) should use",
    undefined,
    types.string
  )
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    const { deployer, multisig } = await hre.getNamedAccounts();
    const rateOracleAddress = rateOracle.address;
    const marginEngines = taskArgs.marginEngines.split(",");

    const data: UpgradeTemplateData = {
      rateOracleUpdates: [],
      proxyUpgrades: [],
    };
    for (const marginEngineAddress of marginEngines) {
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
      )) as MarginEngine;
      const lookbackWindowInSeconds =
        await marginEngine.lookbackWindowInSeconds();
      const vammAddress = await marginEngine.vamm();
      const vamm = (await hre.ethers.getContractAt(
        "VAMM",
        vammAddress
      )) as VAMM;
      const proxyOwner = await marginEngine.owner();

      // TODO: check that rate oracle has data older than min(IRS start timestamp, current time - lookback window)

      if (taskArgs.multisig) {
        // Using multisig template instead of sending any transactions
        data.rateOracleUpdates.push({
          marginEngineAddress,
          vammAddress,
          rateOracleAddress,
          lookbackWindowInSeconds,
        });
      } else {
        // Not using multisig template - actually send the transactions
        if (multisig !== proxyOwner && deployer !== proxyOwner) {
          console.log(
            `Not authorised to update MarginEngine ${marginEngineAddress} (owned by ${proxyOwner})`
          );
        } else {
          await marginEngine
            .connect(await getSigner(hre, proxyOwner))
            .setRateOracle(rateOracleAddress);
          await vamm
            .connect(await getSigner(hre, proxyOwner))
            .refreshRateOracle();
          await marginEngine.setLookbackWindowInSeconds(
            lookbackWindowInSeconds
          );
          // TODO: set lookback window to existing value to force refresh
        }
        console.log(
          `MarginEngine (${marginEngineAddress}) and VAMM (${vammAddress}) updated to point at latest ${taskArgs.rateOracle} (${rateOracleAddress})`
        );
      }
    }

    if (taskArgs.multisig) {
      writeUpgradeTransactionsToGnosisSafeTemplate(data);
    }
  });

task(
  "updatePeriphery",
  "Change the RateOracle used by a given list of MarginEngines instances (i.e. proxies) and their corresponding VAMMs"
)
  .addParam(
    "peripheryProxyAddress",
    "The address of the periphery proxy",
    undefined,
    types.string
  )
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .setAction(async (taskArgs, hre) => {
    // Some prep work before we loop through the VAMMs
    const latestPeripheryLogicAddress = (
      await hre.ethers.getContract("Periphery")
    ).address;
    const { deployer, multisig } = await hre.getNamedAccounts();
    const data: UpgradeTemplateData = {
      rateOracleUpdates: [],
      proxyUpgrades: [],
    };

    const peripheryProxy = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.peripheryProxyAddress
    )) as VAMM;
    const proxyAddress = peripheryProxy.address;
    const initImplAddress = await getImplementationAddress(hre, proxyAddress);
    const proxyOwner = await peripheryProxy.owner();

    if (initImplAddress === latestPeripheryLogicAddress) {
      console.log(
        `The VAMM at ${proxyAddress} is using the latest logic (${latestPeripheryLogicAddress}). No newer logic deployed!`
      );
    } else {
      // TODO: compare storage layouts and abort upgrade if not compatible

      if (taskArgs.multisig) {
        // Using multisig template instead of sending any transactions
        data.proxyUpgrades.push({
          proxyAddress: peripheryProxy.address,
          newImplementation: latestPeripheryLogicAddress,
        });
      } else {
        // Not using multisig template - actually send the transactions
        if (multisig !== proxyOwner && deployer !== proxyOwner) {
          console.log(
            `Not authorised to upgrade the proxy at ${proxyAddress} (owned by ${proxyOwner})`
          );
        } else {
          await peripheryProxy
            .connect(await getSigner(hre, proxyOwner))
            .upgradeTo(latestPeripheryLogicAddress);
          const newImplAddress = await getImplementationAddress(
            hre,
            proxyAddress
          );
          console.log(
            `Periphery at ${peripheryProxy.address} has been upgraded from implementation ${initImplAddress} to ${newImplAddress}`
          );
        }
      }
    }

    if (taskArgs.multisig) {
      writeUpgradeTransactionsToGnosisSafeTemplate(data);
    }
  });

module.exports = {};
