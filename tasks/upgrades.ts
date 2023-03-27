import { task, types } from "hardhat/config";
import {
  MarginEngine,
  OwnableUpgradeable,
  Periphery,
  UUPSUpgradeable,
  VAMM,
} from "../typechain";
import { Contract, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";
import { getConfig } from "../deployConfig/config";
import { getSigner } from "./utils/getSigner";

const _ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
interface UpgradeTemplateData {
  multisig: string;
  chainId: string;
  proxyUpgrades: { proxyAddress: string; newImplementation: string }[];
  factoryUpdates?: {
    factoryAddress: string;
    newMasterMarginEngine?: string;
    newMasterVAMM?: string;
  };
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

function writeUpgradeTransactionsToGnosisSafeTemplate(
  data: UpgradeTemplateData
) {
  // Get external template with fetch
  try {
    const template = fs.readFileSync(
      path.join(__dirname, "templates/upgradeProxies.json.mustache"),
      "utf8"
    );
    const output = mustache.render(template, data);

    const file = `./tasks/JSONs/${data.chainId}-upgradeProxies.json`;
    fs.writeFileSync(file, output);
  } catch (e) {
    console.log("error:", e);
  }
}

async function getImplementationAddress(
  hre: HardhatRuntimeEnvironment,
  proxyAddress: string
) {
  const implHex = await hre.ethers.provider.getStorageAt(
    proxyAddress,
    _ERC1967_IMPLEMENTATION_SLOT
  );

  // We strip out zeros from the 32 byte storage slot, but we must pad it back to 20 bytes in case the address starts with one or more zeros
  return ethers.utils.getAddress(
    hre.ethers.utils.hexZeroPad(hre.ethers.utils.hexStripZeros(implHex), 20)
  );
}

async function assertProxyIsOfType(
  proxyContract: Contract,
  contractType: string
) {
  if (contractType === "MarginEngine") {
    try {
      const marginEngine = proxyContract as MarginEngine;
      // All MarginEngines implement cacheMaxAgeInSeconds
      await marginEngine.cacheMaxAgeInSeconds();
    } catch (e) {
      console.error(e);
      throw Error(
        `Proxy at ${proxyContract.address} does not appear to be of type: ${contractType}`
      );
    }
  } else if (contractType === "VAMM") {
    try {
      const vamm = proxyContract as VAMM;
      // All VAMMs implement feeWad
      await vamm.feeWad();
    } catch (e) {
      console.error(e);
      throw Error(
        `Proxy at ${proxyContract.address} does not appear to be of type: ${contractType}`
      );
    }
  } else {
    // TODO: add support for periphery
    throw Error(
      `Could not assert that proxy at ${proxyContract.address} is of type: ${contractType}`
    );
  }
}

// Description:
//   This task generates tx json to upgrade proxies and set new implementations in Factory if --multisig flag is set;
//   otherwise, it sends the txs directly.
//
// Example:
//   ``npx hardhat upgradeProxy --network mainnet --multisig --factory --contract-type VAMM --proxy-addresses 0xae16Bb8Fe13001b61DdB44e2cEae472D6af08755,0x538E4FFeE8AEd76EfE35565c322a7B0d8cDb4CFF``

task(
  "upgradeProxy",
  "Upgrades the factory's implementation address and/or proxy instances (e.g. VAMMs, MarginEngines) to use the latest deployed implementation logic"
)
  .addParam(
    "contractType",
    `The contract types for which we wish to upgrade the implementation. Choose from ${proxiedContractTypesAsString}.`,
    undefined,
    types.string
  )
  .addParam(
    "proxyAddresses",
    "Comma-separated list of addresses of the proxies that we wish to upgrade",
    undefined,
    types.string,
    true
  )
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addFlag(
    "factory",
    "If set, will also update the factory's pointer to the appropriate implementation"
  )
  .setAction(async (taskArgs, hre) => {
    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    const { deployer } = await hre.getNamedAccounts();

    // Some prep work before we loop through the proxies
    if (!proxiedContractTypes.includes(taskArgs.contractType)) {
      throw Error(`Unsupported contract type: ${taskArgs.contractType}`);
    }

    const latestImplLogicAddress = (
      await hre.ethers.getContract(taskArgs.contractType)
    ).address;

    const data: UpgradeTemplateData = {
      proxyUpgrades: [],
      multisig,
      chainId: await hre.getChainId(),
    };

    if (taskArgs.proxyAddresses) {
      const proxyAddresses = taskArgs.proxyAddresses.split(",");

      // Now loop through all the proxies we want to upgrade
      for (const currentProxyAddress of proxyAddresses) {
        const proxy = (await hre.ethers.getContractAt(
          taskArgs.contractType,
          currentProxyAddress
        )) as UUPSUpgradeable;

        await assertProxyIsOfType(proxy, taskArgs.contractType);

        const initImplAddress = await getImplementationAddress(
          hre,
          currentProxyAddress
        );

        // TODO: check that the proxy is of the specified type and that we are not, e.g., upgrading a VAMM to be a MarginEngine!

        const ownableProxy = proxy as unknown as OwnableUpgradeable;
        const proxyOwner = await ownableProxy.owner();

        if (initImplAddress === latestImplLogicAddress) {
          console.log(
            `The ${taskArgs.contractType} at ${currentProxyAddress} is using the latest logic (${latestImplLogicAddress}). No newer logic deployed!`
          );
        } else {
          // TODO: compare storage layouts and abort upgrade if not compatible

          if (taskArgs.multisig) {
            // Using multisig template instead of sending any transactions
            data.proxyUpgrades.push({
              proxyAddress: proxy.address,
              newImplementation: latestImplLogicAddress,
            });
          } else {
            // Not using multisig template - actually send the transactions
            if (multisig !== proxyOwner && deployer !== proxyOwner) {
              console.log(
                `Not authorised to upgrade the proxy at ${currentProxyAddress} (owned by ${proxyOwner})`
              );
            } else {
              await proxy
                .connect(await getSigner(hre, proxyOwner))
                .upgradeTo(latestImplLogicAddress);

              const newImplAddress = await getImplementationAddress(
                hre,
                currentProxyAddress
              );
              console.log(
                `${taskArgs.contractType} at ${proxy.address} has been upgraded from implementation ${initImplAddress} to ${newImplAddress}`
              );
            }
          }
        }
      }
    }

    if (taskArgs.factory) {
      const factory = await hre.ethers.getContract("Factory");

      if (taskArgs.multisig) {
        data.factoryUpdates = {
          factoryAddress: factory.address,
        };

        if (taskArgs.contractType === "MarginEngine") {
          data.factoryUpdates.newMasterMarginEngine = latestImplLogicAddress;
        } else if (taskArgs.contractType === "VAMM") {
          data.factoryUpdates.newMasterVAMM = latestImplLogicAddress;
        }
      } else {
        // Not using multisig template - actually send the transactions
        const factoryOwner = await factory.owner();
        if (multisig !== factoryOwner && deployer !== factoryOwner) {
          console.log(
            `Not authorised to upgrade the proxy at ${factory.address} (owned by ${factoryOwner})`
          );
        } else {
          if (taskArgs.contractType === "MarginEngine") {
            await factory
              .connect(await getSigner(hre, factoryOwner))
              .setMasterMarginEngine(latestImplLogicAddress);
          } else if (taskArgs.contractType === "VAMM") {
            await factory
              .connect(await getSigner(hre, factoryOwner))
              .setMasterVAMM(latestImplLogicAddress);
          }
          console.log(
            `Factory at ${factory.address} now points to ${taskArgs.contractType} implementaion ${latestImplLogicAddress}`
          );
        }
      }
    }

    if (taskArgs.multisig) {
      writeUpgradeTransactionsToGnosisSafeTemplate(data);
    }
  });

// Description:
//   This task generates tx json to upgrade Periphery proxy if --multisig flag is set;
//   otherwise, it sends the txs directly.
//
// Example:
//   ``npx hardhat upgradePeriphery --network mainnet --multisig --periphery-proxy-address 0x07ceD903E6ad0278CC32bC83a3fC97112F763722``
//
// TODO: combine the tasks for periphery with the other upgrade contracts

task(
  "upgradePeriphery",
  "Changes the Periphery Proxy to use to the newly deployed implemenatation logic"
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
    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    const { deployer } = await hre.getNamedAccounts();

    // Some prep work before we loop through the VAMMs
    const latestPeripheryLogicAddress = (
      await hre.ethers.getContract("Periphery_Implementation")
    ).address;

    const data: UpgradeTemplateData = {
      proxyUpgrades: [],
      multisig,
      chainId: await hre.getChainId(),
    };

    const peripheryProxy = (await hre.ethers.getContractAt(
      "Periphery",
      taskArgs.peripheryProxyAddress
    )) as Periphery;

    const proxyAddress = peripheryProxy.address;
    const initImplAddress = await getImplementationAddress(hre, proxyAddress);
    const proxyOwner = await peripheryProxy.owner();

    if (initImplAddress === latestPeripheryLogicAddress) {
      console.log(
        `The Periphery at ${proxyAddress} is using the latest logic (${latestPeripheryLogicAddress}). No newer logic deployed!`
      );
    } else {
      // TODO: compare storage layouts and abort upgrade if not compatible
      console.log("Updating implementation used by periphery proxy");

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
          console.log("Upgrading to ", latestPeripheryLogicAddress);
          const tx = await peripheryProxy
            .connect(await getSigner(hre, proxyOwner))
            .upgradeTo(latestPeripheryLogicAddress);
          await tx.wait();

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
