import { task, types } from "hardhat/config";
import * as fs from "fs";
import path from "path";

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

// Description:
//   This task deploys new implementations for the contract types mentioned above.
//
// Example:
//   ``npx hardhat deployUpdatedImplementations --network mainnet --contract-names VAMM``

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
  .setAction(async (taskArgs, hre) => {
    const contractNames = taskArgs.contractNames.split(",");
    for (const contractName of contractNames) {
      if (!proxiedContractTypes.includes(contractName)) {
        throw Error(`Unsupported contract type: ${contractName}`);
      }
    }

    for (const contractName of contractNames) {
      // Path of JSON artifacts for deployed (not compiled) contracts, relative to this tasks directory
      const deployedArtifactsDir = path.join(
        __dirname,
        "..",
        "deployments",
        hre.network.name
      );

      let implementationArtifactName;

      if (contractName === "Periphery") {
        // For the periphery, we have artifacts for both the Periphery logic implementation contract and for its single proxy
        implementationArtifactName = "Periphery_Implementation";

        // We take a backup of the proxy contract's artifact because it may get overwritten
        // We will restore this at the end of the process
        const currentProxyArtifact = path.join(
          deployedArtifactsDir,
          `${contractName}.json`
        );
        fs.copyFileSync(currentProxyArtifact, `${currentProxyArtifact}.backup`);
      } else {
        // For non-Periphery contracts, the (many) proxies are deployed from the factory and we only maintain artifacts for the implementation
        implementationArtifactName = contractName;
      }

      const currentImplAddress = (
        await hre.ethers.getContract(implementationArtifactName)
      ).address;

      // TODO: compare storage layouts and warn/abort if not compatible

      // Take a backup of the most recently deployed implementation artifact file before we overwrite it
      const currentImplArtifactPath = path.join(
        deployedArtifactsDir,
        `${implementationArtifactName}.json`
      );

      // We use an archive directory to store details of every previous implementation
      const archiveDir = path.join(deployedArtifactsDir, "history");
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      // Copy the file into the archive directory. If deployment fails it should also stay in the main folder.
      const archivedImplArtifactPath = path.join(
        archiveDir,
        `${implementationArtifactName}.${currentImplAddress}.json`
      );
      fs.copyFileSync(currentImplArtifactPath, archivedImplArtifactPath);

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

      if (contractName === "Periphery") {
        // Move the new implementation artifact from Periphery.json to Periphery_Implemenatation.json
        const proxyArtifactPath = path.join(
          deployedArtifactsDir,
          `${contractName}.json`
        );

        fs.renameSync(proxyArtifactPath, currentImplArtifactPath);
        console.log(
          "Renamed just deployed impl to Periphery_Implementation.json"
        );

        // Restore the backup we took of Periphery.sol, which is actually an artifact that points at the proxy address
        fs.copyFileSync(`${proxyArtifactPath}.backup`, proxyArtifactPath);
        fs.unlinkSync(`${proxyArtifactPath}.backup`);

        console.log("Moved proxy back to deployment files");
      }
    }

    if (hre.network.live) {
      console.log(
        "\nIf new contracts were deployed, please verify them now before making any other changes:"
      );
      console.log(
        `\tnpx hardhat --network ${hre.network.name} etherscan-verify`
      );
      console.log("See readme for troubleshooting or additional details.");
    }
  });

module.exports = {};
