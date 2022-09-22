import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";
import {
  applyBufferConfig,
  convertTrustedRateOracleDataPoints,
  RateOracleConfigForTemplate,
} from "../deployConfig/utils";
import { BaseRateOracle, ERC20, IAaveV2LendingPool } from "../typechain";
import { BigNumber, BigNumberish } from "ethers";
import path from "path";
import mustache from "mustache";
import {
  Datum,
  mainnetAaveDataGenerator,
} from "../historicalData/generators/aave";
import { TokenConfig } from "../deployConfig/types";

interface RateOracleInstanceInfo {
  contractName: string;
  args: any[];
  suffix: string | null;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
  maxIrsDurationInSeconds: number;
}

interface RateOracleConfigTemplateData {
  rateOracles: RateOracleConfigForTemplate[];
}

async function writeRateOracleConfigToGnosisSafeTemplate(
  data: RateOracleConfigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "..", "tasks", "rateOracleConfig.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const jsonDir = path.join(__dirname, "..", "tasks", "JSONs");
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
  }
  fs.writeFileSync(
    path.join(__dirname, "..", "tasks", "JSONs", "rateOracleConfig.json"),
    output
  );
}

let multisigConfig: RateOracleConfigForTemplate[] = [];

interface DeployAndConfigureWithGeneratorArgs {
  hre: HardhatRuntimeEnvironment;
  initialArgs: any[];
  tokenDefinition: TokenConfig;
  contractName: string;
  trustedDataPointsGenerator: AsyncGenerator<Datum> | null;
}

const deployAndConfigureWithGenerator = async ({
  hre,
  initialArgs,
  tokenDefinition,
  contractName,
  trustedDataPointsGenerator: generator,
}: DeployAndConfigureWithGeneratorArgs) => {
  // Get the trusted timestamps using the generator
  let timestamps: number[] = [];
  let rates: BigNumber[] = [];

  // TODO: combine this function with deployAndConfigureRateOracleInstance, and then only utilise the generator if we are actually going to deploy
  if (!!generator) {
    for await (const data of generator) {
      timestamps.push(data.timestamp);
      rates.push(data.rate);
    }

    console.log(
      `Got historical data (in function): ${JSON.stringify(
        timestamps
      )}, ${JSON.stringify((rates as BigNumber[]).map((r) => r.toString()))}`
    );

    // We skip the most recent timestamp & rate, since it should be from ~now and the contract will write this itself
    timestamps = timestamps.slice(0, -1);
    rates = rates.slice(0, -1);
  }

  const args = [...initialArgs, timestamps, rates];
  console.log(`Deployment args are ${args.map((a) => a.toString())}`);

  // Get the maxIrsDuration (used to sanity check buffer size)
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const maxIrsDurationInSeconds = deployConfig.maxIrsDurationInSeconds;

  await deployAndConfigureRateOracleInstance(hre, {
    args,
    suffix: tokenDefinition.name,
    contractName,
    rateOracleBufferSize: tokenDefinition.rateOracleBufferSize,
    minSecondsSinceLastUpdate: tokenDefinition.minSecondsSinceLastUpdate,
    maxIrsDurationInSeconds,
  });
};

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

  const ownerOfRateOracle = await rateOracleContract.owner();

  if (deployer.toLowerCase() === ownerOfRateOracle.toLowerCase()) {
    // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
    await applyBufferConfig(
      rateOracleContract,
      BigNumber.from(instance.rateOracleBufferSize).toNumber(),
      instance.minSecondsSinceLastUpdate,
      instance.maxIrsDurationInSeconds
    );
  } else {
    // We do not have permissions to update rate oracle config, so we do a dry run to report out-of-date state
    const multisigChanges = await applyBufferConfig(
      rateOracleContract,
      BigNumber.from(instance.rateOracleBufferSize).toNumber(),
      instance.minSecondsSinceLastUpdate,
      instance.maxIrsDurationInSeconds,
      true
    );
    multisigConfig = multisigConfig.concat(multisigChanges);
  }

  if (multisig.toLowerCase() !== ownerOfRateOracle.toLowerCase()) {
    console.log(
      `Transferring ownership of ${rateOracleIdentifier} at ${rateOracleContract.address} to ${multisig}`
    );
    if (deployer.toLowerCase() === ownerOfRateOracle.toLowerCase()) {
      const trx = await rateOracleContract.transferOwnership(multisig);
      await trx.wait();
    } else {
      throw new Error(
        `Owner of rate oracle(${ownerOfRateOracle}}) is not deployer(${deployer}).`
      );
    }
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name;
  const deployConfig = getConfig(network);

  {
    // Aave Rate Oracles
    // Configure these if we have a lending pool and one or more tokens configured
    const aaveConfig = deployConfig.aaveConfig;
    const existingAaveLendingPoolAddress = aaveConfig?.aaveLendingPool;
    const aaveTokens = aaveConfig?.aaveTokens;

    // console.log("aaveTokens", JSON.stringify(aaveTokens, null, 2));
    // console.log("existingAaveLendingPoolAddress", existingAaveLendingPoolAddress);
    if (existingAaveLendingPoolAddress && aaveTokens) {
      const aaveLendingPool = (await ethers.getContractAt(
        "IAaveV2LendingPool",
        existingAaveLendingPoolAddress
      )) as IAaveV2LendingPool;

      for (const tokenDefinition of aaveTokens) {
        let args: (string | BigNumberish[])[] = [];
        if (tokenDefinition.trustedDataPoints) {
          // TODO: delete this code branch and the trustedDataPoints type once we migrate fully to daysOfTrustedDataPoints
          const { trustedTimestamps, trustedObservationValuesInRay } =
            convertTrustedRateOracleDataPoints(
              tokenDefinition.trustedDataPoints || []
            );

          // For Aave, the first two constructor args are lending pool address and underlying token address
          // For Aave, the address in the tokenDefinition is the address of the underlying token
          args = [
            aaveLendingPool.address,
            tokenDefinition.address,
            trustedTimestamps,
            trustedObservationValuesInRay,
          ];
          await deployAndConfigureRateOracleInstance(hre, {
            args,
            suffix: tokenDefinition.name,
            contractName: tokenDefinition.borrow
              ? "AaveBorrowRateOracle"
              : "AaveRateOracle",
            rateOracleBufferSize: tokenDefinition.rateOracleBufferSize,
            minSecondsSinceLastUpdate:
              tokenDefinition.minSecondsSinceLastUpdate,
            maxIrsDurationInSeconds: deployConfig.maxIrsDurationInSeconds,
          });
        } else {
          let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

          if (tokenDefinition.daysOfTrustedDataPoints) {
            trustedDataPointsGenerator = await mainnetAaveDataGenerator(
              hre,
              tokenDefinition.address,
              tokenDefinition.daysOfTrustedDataPoints,
              false,
              { lendingPool: aaveLendingPool }
            );
          }

          await deployAndConfigureWithGenerator({
            hre,
            initialArgs: [aaveLendingPool.address, tokenDefinition.address],
            tokenDefinition,
            contractName: tokenDefinition.borrow
              ? "AaveBorrowRateOracle"
              : "AaveRateOracle",
            trustedDataPointsGenerator,
          });
        }
      }
    }
    // End of Aave Rate Oracles
  }

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

      // console.log("cToken", cToken.address);

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
          tokenDefinition.trustedDataPoints || []
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
        rateOracleBufferSize: tokenDefinition.rateOracleBufferSize,
        minSecondsSinceLastUpdate: tokenDefinition.minSecondsSinceLastUpdate,
        maxIrsDurationInSeconds: deployConfig.maxIrsDurationInSeconds,
      });
    }
  }
  // End of Compound Rate Oracles

  // Compound Borrow Rate Oracles
  // Configure these if we have a one or more cTokens configured
  const compoundBorrowConfig = deployConfig.compoundBorrowConfig;
  const compoundBorrowTokens =
    compoundBorrowConfig && compoundBorrowConfig.compoundTokens;

  if (compoundBorrowTokens) {
    for (const tokenDefinition of compoundBorrowTokens) {
      const cToken = await ethers.getContractAt(
        "ICToken",
        tokenDefinition.address
      );

      // console.log("cToken", cToken.address);

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
          tokenDefinition.trustedDataPoints || []
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
        contractName: "CompoundBorrowRateOracle",
        rateOracleBufferSize: tokenDefinition.rateOracleBufferSize,
        minSecondsSinceLastUpdate: tokenDefinition.minSecondsSinceLastUpdate,
        maxIrsDurationInSeconds: deployConfig.maxIrsDurationInSeconds,
      });
    }
  }
  // End of Compound Borrow Rate Oracles

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
      rateOracleBufferSize: lidoConfig.defaults.rateOracleBufferSize,
      minSecondsSinceLastUpdate: lidoConfig.defaults.minSecondsSinceLastUpdate,
      maxIrsDurationInSeconds: deployConfig.maxIrsDurationInSeconds,
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
      rateOracleBufferSize: rocketPoolConfig.defaults.rateOracleBufferSize,
      minSecondsSinceLastUpdate:
        rocketPoolConfig.defaults.minSecondsSinceLastUpdate,
      maxIrsDurationInSeconds: deployConfig.maxIrsDurationInSeconds,
    });
  }
  // End of Rocket Pool Rate Oracle
  if (multisigConfig.length > 0) {
    // Flag the last entry to tell the template to stop adding commas
    multisigConfig[multisigConfig.length - 1].last = true;
    await writeRateOracleConfigToGnosisSafeTemplate({
      rateOracles: multisigConfig,
    });
  }

  return false; // This script is safely re-runnable and will try to reconfigure existing rate oracles if required
};
func.tags = ["RateOracles"];
func.id = "RateOracles";
export default func;
