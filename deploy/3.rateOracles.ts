import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  applyBufferConfig,
  convertTrustedRateOracleDataPoints,
  getConfig,
} from "../deployConfig/config";
import { BaseRateOracle, ERC20 } from "../typechain";
import { TokenConfig } from "../deployConfig/types";
import { config } from "dotenv";

interface RateOracleInstanceInfo {
  contractName: string;
  args: any[];
  tokenDefinition: TokenConfig;
  maxIrsDurationInSeconds: number;
}

const deployAndConfigureRateOracleInstance = async (
  hre: HardhatRuntimeEnvironment,
  instance: RateOracleInstanceInfo
) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  const rateOracleIdentifier = `${instance.contractName}_${instance.tokenDefinition.name}`;
  let rateOracleContract = (await ethers.getContractOrNull(
    rateOracleIdentifier
  )) as BaseRateOracle;

  if (!rateOracleContract) {
    // There is no Aave rate oracle already deployed for this token. Deploy one now.
    await deploy(rateOracleIdentifier, {
      contract: instance.contractName,
      from: deployer,
      args: instance.args,
      log: doLogging,
    });
    console.log(
      `Deployed ${rateOracleIdentifier} (args: ${instance.args.join(",")})`
    );

    rateOracleContract = (await ethers.getContract(
      rateOracleIdentifier
    )) as BaseRateOracle;
  }

  // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
  await applyBufferConfig(
    rateOracleContract as unknown as BaseRateOracle,
    instance.tokenDefinition.rateOracleBufferSize,
    instance.tokenDefinition.minSecondsSinceLastUpdate,
    instance.maxIrsDurationInSeconds
  );
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name;
  const deployConfig = getConfig(network);

  // Aave Rate Oracles
  // Configure these if we have a lending pool and one or more tokens configured
  const aaveConfig = deployConfig.aaveConfig;
  const existingAaveLendingPoolAddress = aaveConfig?.aaveLendingPool;
  const aaveTokens = aaveConfig?.aaveTokens;

  if (existingAaveLendingPoolAddress && aaveTokens) {
    const aaveLendingPool = await ethers.getContractAt(
      "IAaveV2LendingPool",
      existingAaveLendingPoolAddress
    );

    for (const tokenDefinition of aaveTokens) {
      const { trustedTimestamps, trustedObservationValuesInRay } =
        convertTrustedRateOracleDataPoints(
          tokenDefinition.trustedDataPoints ||
            aaveConfig.defaults.trustedDataPoints
        );

      // For Aave, the first two constructor args are lending pool address and underlying token address
      // For Aave, the address in the tokenDefinition is the address of the underlying token
      const args = [
        aaveLendingPool.address,
        tokenDefinition.address,
        trustedTimestamps,
        trustedObservationValuesInRay,
      ];

      deployAndConfigureRateOracleInstance(hre, {
        args,
        tokenDefinition,
        contractName: "CompoundRateOracle",
        maxIrsDurationInSeconds: deployConfig.irsConfig.maxIrsDurationInSeconds,
      });
    }
  }
  // End of Aave Rate Oracles

  // Compound Rate Oracles
  // Configure these if we have a one or more cTokens configured
  const compoundConfig = deployConfig.compoundConfig;
  const compoundTokens = compoundConfig && compoundConfig.compoundTokens;

  if (compoundTokens) {
    for (const tokenDefinition of compoundTokens) {
      const cToken = await ethers.getContractAt(
        "ICToken",
        tokenDefinition.address
      );

      const underlying = (await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
        await cToken.underlying()
      )) as ERC20;

      const decimals = await underlying.decimals();

      const { trustedTimestamps, trustedObservationValuesInRay } =
        convertTrustedRateOracleDataPoints(
          tokenDefinition.trustedDataPoints ||
            compoundConfig.defaults.trustedDataPoints
        );

      // For Compound, the first three constructor args are the cToken address, underylying address and decimals of the underlying
      // For Compound, the address in the tokenDefinition is the address of the underlying cToken
      const args = [
        cToken.address,
        underlying.address,
        decimals,
        trustedTimestamps,
        trustedObservationValuesInRay,
      ];

      deployAndConfigureRateOracleInstance(hre, {
        args,
        tokenDefinition,
        contractName: "CompoundRateOracle",
        maxIrsDurationInSeconds: deployConfig.irsConfig.maxIrsDurationInSeconds,
      });
    }
  }
  // End of Compound Rate Oracles
  const lidoConfig = deployConfig.lidoConfig;
  const lidoStETHAddress = lidoConfig?.lidoStETH;

  // Lido Rate Oracle
  // if (lidoStETHAddress) {
  //   const { trustedTimestamps, trustedObservationValuesInRay } =
  //     convertTrustedRateOracleDataPoints(lidoConfig.defaults.trustedDataPoints);

  //   // For Aave, the first two constructor args are lending pool address and underlying token address
  //   // For Aave, the address in the tokenDefinition is the address of the underlying token
  //   const args = [
  //     lidoStETHAddress,
  //     trustedTimestamps,
  //     trustedObservationValuesInRay,
  //   ];

  //   deployAndConfigureRateOracleInstance(hre, {
  //     args,
  //     contractName: "CompoundRateOracle",
  //     maxIrsDurationInSeconds: deployConfig.irsConfig.maxIrsDurationInSeconds
  //   });
  // }

  return false; // This script is safely re-runnable and will reconfigure existing rate oracles if required
};
func.tags = ["RateOracles"];
func.id = "RateOracles";
export default func;
