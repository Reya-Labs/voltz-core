import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  applyBufferConfig,
  convertTrustedRateOracleDataPoints,
  getConfig,
} from "../deployConfig/config";
import { BaseRateOracle, ERC20 } from "../typechain";
import { RateOracleConfigDefaults } from "../deployConfig/types";
import { BigNumber } from "ethers";

interface RateOracleInstanceInfo {
  contractName: string;
  args: any[];
  suffix: string | null;
  rateOracleConfig: RateOracleConfigDefaults;
  maxIrsDurationInSeconds: number;
}

const deployAndConfigureRateOracleInstance = async (
  hre: HardhatRuntimeEnvironment,
  instance: RateOracleInstanceInfo
) => {
  const { deploy } = hre.deployments;
  const { deployer, multisig } = await hre.getNamedAccounts();
  const doLogging = true;

  const rateOracleIdentifier =
    instance.contractName + (instance.suffix ? "_" + instance.suffix : "");
  let rateOracleContract = (await ethers.getContractOrNull(
    rateOracleIdentifier
  )) as BaseRateOracle;

  if (!rateOracleContract) {
    // There is no rate oracle already deployed with this rateOracleIdentifier. Deploy one now.
    // console.log("rateOracleIdentifier", rateOracleIdentifier);
    // console.log("instance.contractName:", instance.contractName);
    // console.log("deployer:", deployer);
    // console.log("args:", instance.args);
    await deploy(rateOracleIdentifier, {
      contract: instance.contractName,
      from: deployer,
      args: instance.args,
      log: doLogging,
      gasLimit: 20000000,
    });
    console.log(
      `Deployed ${rateOracleIdentifier} (args: ${JSON.stringify(
        instance.args
      )})`
    );

    rateOracleContract = (await ethers.getContract(
      rateOracleIdentifier
    )) as BaseRateOracle;
  }

  // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
  await applyBufferConfig(
    rateOracleContract,
    BigNumber.from(instance.rateOracleConfig.rateOracleBufferSize).toNumber(),
    instance.rateOracleConfig.rateOracleMinSecondsSinceLastUpdate,
    instance.maxIrsDurationInSeconds
  );

  if (multisig !== deployer) {
    // Transfer ownership
    console.log(
      `Transferred ownership of ${rateOracleIdentifier} at ${rateOracleContract.address} to ${multisig}`
    );
    await rateOracleContract.transferOwnership(multisig);
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name;
  const deployConfig = getConfig(network);

  // Aave Rate Oracles
  // Configure these if we have a lending pool and one or more tokens configured
  const aaveConfig = deployConfig.aaveConfig;
  const existingAaveLendingPoolAddress = aaveConfig?.aaveLendingPool;
  const aaveTokens = aaveConfig?.aaveTokens;

  // console.log("aaveTokens", aaveTokens);
  // console.log("existingAaveLendingPoolAddress", existingAaveLendingPoolAddress);
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

      await deployAndConfigureRateOracleInstance(hre, {
        args,
        suffix: tokenDefinition.name,
        contractName: "AaveRateOracle",
        rateOracleConfig: aaveConfig.defaults,
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

      console.log("cToken", cToken.address);

      let underlyingAddress: string;
      let underlyingDecimals: number;
      let ethPool: boolean;

      if (tokenDefinition.name === "cETH") {
        if (deployConfig.weth) {
          underlyingAddress = deployConfig.weth;
          underlyingDecimals = 18;
          ethPool = true;
        } else {
          throw new Error("WETH not found");
        }
      } else {
        const underlying = (await ethers.getContractAt(
          "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
          await cToken.underlying()
        )) as ERC20;

        underlyingAddress = underlying.address;
        underlyingDecimals = await underlying.decimals();
        ethPool = false;
      }

      const { trustedTimestamps, trustedObservationValuesInRay } =
        convertTrustedRateOracleDataPoints(
          tokenDefinition.trustedDataPoints ||
            compoundConfig.defaults.trustedDataPoints
        );

      // For Compound, the first three constructor args are the cToken address, underylying address and decimals of the underlying
      // For Compound, the address in the tokenDefinition is the address of the underlying cToken
      const args = [
        cToken.address,
        ethPool,
        underlyingAddress,
        underlyingDecimals,
        trustedTimestamps,
        trustedObservationValuesInRay,
      ];

      await deployAndConfigureRateOracleInstance(hre, {
        args,
        suffix: tokenDefinition.name,
        contractName: "CompoundRateOracle",
        rateOracleConfig: compoundConfig.defaults,
        maxIrsDurationInSeconds: deployConfig.irsConfig.maxIrsDurationInSeconds,
      });
    }
  }
  // End of Compound Rate Oracles

  // Lido Rate Oracle
  const lidoConfig = deployConfig.lidoConfig;
  const lidoStETHAddress = lidoConfig?.lidoStETH;
  const lidoOracleAddress = lidoConfig?.lidoOracle;

  if (lidoStETHAddress) {
    const { trustedTimestamps, trustedObservationValuesInRay } =
      convertTrustedRateOracleDataPoints(lidoConfig.defaults.trustedDataPoints);

    let wethAddress: string;
    if (deployConfig.weth) {
      wethAddress = deployConfig.weth;
    } else {
      throw new Error("WETH not found");
    }

    // For Lido, the first constructor arg is the stEth address
    const args = [
      lidoStETHAddress,
      lidoOracleAddress,
      wethAddress,
      trustedTimestamps,
      trustedObservationValuesInRay,
    ];

    await deployAndConfigureRateOracleInstance(hre, {
      args,
      suffix: null,
      contractName: "LidoRateOracle",
      rateOracleConfig: lidoConfig.defaults,
      maxIrsDurationInSeconds: deployConfig.irsConfig.maxIrsDurationInSeconds,
    });
  }
  // End of Lido Rate Oracle

  // RocketPool Rate Oracle
  const rocketPoolConfig = deployConfig.rocketPoolConfig;
  const rocketEthAddress = rocketPoolConfig?.rocketPoolRocketToken;
  const rocketNetworkBalancesAddress = rocketPoolConfig?.rocketNetworkBalances;

  if (rocketEthAddress && rocketNetworkBalancesAddress) {
    const { trustedTimestamps, trustedObservationValuesInRay } =
      convertTrustedRateOracleDataPoints(
        rocketPoolConfig.defaults.trustedDataPoints
      );

    let wethAddress: string;
    if (deployConfig.weth) {
      wethAddress = deployConfig.weth;
    } else {
      throw new Error("WETH not found");
    }

    // For RocketPool, the first constructor arg is the rocketEth (RETH) address
    const args = [
      rocketEthAddress,
      rocketNetworkBalancesAddress,
      wethAddress,
      trustedTimestamps,
      trustedObservationValuesInRay,
    ];

    await deployAndConfigureRateOracleInstance(hre, {
      args,
      suffix: null,
      contractName: "RocketPoolRateOracle",
      rateOracleConfig: rocketPoolConfig.defaults,
      maxIrsDurationInSeconds: deployConfig.irsConfig.maxIrsDurationInSeconds,
    });
  }
  // End of Rocket Pool Rate Oracle

  return false; // This script is safely re-runnable and will reconfigure existing rate oracles if required
};
func.tags = ["RateOracles"];
func.id = "RateOracles";
export default func;
