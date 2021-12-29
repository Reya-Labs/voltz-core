// template taken from https://github.com/pendle-finance/pendle-core/blob/master/scripts/helpers/deployHelpers.ts

import { BigNumber, utils } from "ethers";
import fs from "fs";

export interface DeployedContract {
  address: string;
  tx: string;
}

export interface Deployment {
  step: number;
  contracts: Record<string, DeployedContract>;
  variables: Record<string, any>;
  // yieldContracts: Record<string, any>;
  directories: Record<string, any>;
}

export function validAddress(variableName: string, address?: string): boolean {
  if (address == null || address === undefined) {
    console.log(`\t\t[ERROR] ${variableName} is empty !`);
    return false;
  }

  if (address.length !== 42) {
    console.log(
      `\t\t[ERROR] ${variableName} is an invalid address = ${address}`
    );
    return false;
  }

  return true;
}

export async function deploy(
  hre: any,
  deployment: Deployment,
  contractName: string,
  args: any[]
): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractName);
  const contractObject = await contractFactory.deploy(...args);
  await contractObject.deployed();
  deployment.contracts[contractName] = {
    address: contractObject.address,
    tx: contractObject.deployTransaction.hash,
  };
  console.log(
    `\t[DEPLOYED] ${contractName} deployed to ${contractObject.address}, tx=${contractObject.deployTransaction.hash}`
  );
  return contractObject;
}

export async function deployWithName(
  hre: any,
  deployment: Deployment,
  contractType: string,
  contractName: string,
  args: any[]
): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractType);
  const contractObject = await contractFactory.deploy(...args);
  await contractObject.deployed();
  if (contractName !== "") {
    deployment.contracts[contractName] = {
      address: contractObject.address,
      tx: contractObject.deployTransaction.hash,
    };
  }
  console.log(
    `\t[DEPLOYED] ${contractName} deployed to ${contractObject.address}, tx=${contractObject.deployTransaction.hash}`
  );
  return contractObject;
}

export async function getContractFromDeployment(
  hre: any,
  deployment: Deployment,
  contractName: string
): Promise<any> {
  const contractFactory = await hre.ethers.getContractFactory(contractName);
  const contractAddress = deployment.contracts[contractName].address;
  if (!validAddress(contractName, contractAddress)) {
    console.log(`[Error] invalid contract address for ${contractName}`);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
  return await contractFactory.attach(contractAddress);
}

export async function sendAndWaitForTransaction(
  hre: any,
  transaction: any,
  transactionDescription: string,
  args: any[]
) {
  const tx = await transaction(...args);
  console.log(
    `\t\t\t[Broadcasted] transaction: ${transactionDescription}: ${tx.hash}, nonce:${tx.nonce}`
  );
  await hre.ethers.provider.waitForTransaction(tx.hash);
  console.log(`\t\t\t[Confirmed] transaction: ${transactionDescription}`);
}

// export async function createNewFactoryContract(
//       hre: any,
//       deployment: Deployment,
// ) {

// }

export function saveDeployment(filePath: string, deployment: Deployment) {
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, "  "), "utf8");
}

export function getDeployment(filePath: string): Deployment {
  const existingDeploymentJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return existingDeploymentJson as Deployment;
}

// todo: adapt to AMM
export function getCreate2Address(
  factoryAddress: string,
  rateOracleId: string,
  underlyingToken: string,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  bytecode: string
): string {
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
    ["bytes32", "address", "uint256", "uint256"],
    [rateOracleId, underlyingToken, termStartTimestamp, termEndTimestamp]
  );

  const create2Inputs = [
    "0xff",
    factoryAddress,
    // salt
    utils.keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    utils.keccak256(bytecode),
  ];

  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join("")}`;
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`);
}

// export async function createNewVAMMContract(
//     hre: any,
//     deployment: Deployment,
//     forgeId: string,
//     underlyingAssetContract: any,
//     expiry: number
//   ) {
//     const pendleRouter = await getContractFromDeployment(hre, deployment, 'PendleRouter');
//     const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');

//     const underlyingAssetSymbol = await underlyingAssetContract.symbol();
//     const underlyingAssetName = await underlyingAssetContract.name();
//     const forgeIdString = utils.parseBytes32String(forgeId);

//     console.log(
//       `\tCreating new yield contract for ${forgeIdString}, underlyingAsset-${underlyingAssetSymbol}, expiry=${expiry}`
//     );

//     console.log(`\t underlyingAssetContract = ${underlyingAssetContract.address}`);
//     await sendAndWaitForTransaction(hre, pendleRouter.newYieldContracts, 'newYieldContract', [
//       forgeId,
//       underlyingAssetContract.address,
//       expiry,
//     ]);
//     const xytAddress = await pendleData.xytTokens(forgeId, underlyingAssetContract.address, expiry);
//     const otAddress = await pendleData.otTokens(forgeId, underlyingAssetContract.address, expiry);
//     console.log(`\t\t xyt address = ${xytAddress}, otAddress = ${otAddress}`);

//     if (deployment.yieldContracts[forgeIdString] == null) {
//       deployment.yieldContracts[forgeIdString] = {};
//     }

//     if (deployment.yieldContracts[forgeIdString][underlyingAssetContract.address] == null) {
//       deployment.yieldContracts[forgeIdString][underlyingAssetContract.address] = {
//         symbol: underlyingAssetSymbol,
//         name: underlyingAssetName,
//         expiries: {},
//         PendleLiquidityMining: {},
//       };
//     }

//     if (deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].expiries[expiry] == null) {
//       deployment.yieldContracts[forgeIdString][underlyingAssetContract.address].expiries[expiry] = {
//         XYT: xytAddress,
//         OT: otAddress,
//         markets: {},
//       };
//     }
//   }
