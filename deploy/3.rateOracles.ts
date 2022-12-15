import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";
import {
  applyBufferConfig,
  RateOracleConfigForTemplate,
} from "../deployConfig/utils";
import {
  BaseRateOracle,
  ERC20,
  IAaveV2LendingPool,
  ILidoOracle,
  IRocketEth,
  IRocketNetworkBalances,
  IStETH,
} from "../typechain";
import { BigNumber } from "ethers";
import path from "path";
import mustache from "mustache";
import { Datum } from "../historicalData/generators/common";
import { buildAaveDataGenerator } from "../historicalData/generators/aave";
import { buildCompoundDataGenerator } from "../historicalData/generators/compound";

import { buildLidoDataGenerator } from "../historicalData/generators/lido";
import { buildRocketDataGenerator } from "../historicalData/generators/rocket";

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
  const outFile = path.join(jsonDir, "rateOracleConfig.json");
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
  }
  fs.writeFileSync(path.join(outFile), output);

  console.log(
    "Rate Oracle reconfiguration transactions written to ",
    outFile.toString()
  );
}

let multisigConfig: RateOracleConfigForTemplate[] = [];

interface RateOracleConfig {
  name: string | null;
  rateOracleBufferSize: number;
  minSecondsSinceLastUpdate: number;
}
interface DeployAndConfigureWithGeneratorArgs {
  hre: HardhatRuntimeEnvironment;
  initialArgs: any[];
  rateOracleConfig: RateOracleConfig;
  contractName: string;
  trustedDataPointsGenerator: AsyncGenerator<Datum> | null;
}

const deployAndConfigureWithGenerator = async ({
  hre,
  initialArgs,
  rateOracleConfig,
  contractName,
  trustedDataPointsGenerator: generator,
}: DeployAndConfigureWithGeneratorArgs) => {
  const { deploy } = hre.deployments;
  const { deployer, multisig } = await hre.getNamedAccounts();
  const doLogging = true;

  // Get the maxIrsDuration (used to sanity check buffer size)
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const maxIrsDurationInSeconds = deployConfig.maxIrsDurationInSeconds;

  const rateOracleIdentifier =
    contractName + (rateOracleConfig.name ? "_" + rateOracleConfig.name : "");
  let rateOracleContract = (await ethers.getContractOrNull(
    rateOracleIdentifier
  )) as BaseRateOracle;

  if (!rateOracleContract) {
    // There is no rate oracle already deployed with this rateOracleIdentifier. Deploy one now. But first, get some trusted data points if required.
    let timestamps: number[] = [];
    let rates: BigNumber[] = [];

    if (generator) {
      for await (const data of generator) {
        if (data.timestamp === timestamps[timestamps.length - 1]) {
          console.log(
            `Ignoring duplicate data point {${data.timestamp}, ${data.rate}}`
          );
        } else {
          timestamps.push(data.timestamp);
          rates.push(data.rate);
        }
      }

      // console.log(
      //   `Got historical data (from generator): ${JSON.stringify(
      //     timestamps
      //   )}, ${JSON.stringify((rates as BigNumber[]).map((r) => r.toString()))}`
      // );

      // We skip the most recent timestamp & rate, since it should be from ~now and the contract will write this itself
      timestamps = timestamps.slice(0, -1);
      rates = rates.slice(0, -1);
    }

    const args = [...initialArgs, timestamps, rates];
    console.log(`Deployment args are ${args.map((a) => a.toString())}`);

    await deploy(rateOracleIdentifier, {
      contract: contractName,
      from: deployer,
      args: args,
      log: doLogging,
      gasLimit: 20000000,
    });
    console.log(`Deployed ${rateOracleIdentifier}})`);

    rateOracleContract = (await ethers.getContract(
      rateOracleIdentifier
    )) as BaseRateOracle;
  }

  const ownerOfRateOracle = await rateOracleContract.owner();

  if (deployer.toLowerCase() === ownerOfRateOracle.toLowerCase()) {
    // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
    await applyBufferConfig(
      rateOracleContract,
      BigNumber.from(rateOracleConfig.rateOracleBufferSize).toNumber(),
      rateOracleConfig.minSecondsSinceLastUpdate,
      maxIrsDurationInSeconds
    );
  } else {
    // We do not have permissions to update rate oracle config, so we do a dry run to report out-of-date state
    const multisigChanges = await applyBufferConfig(
      rateOracleContract,
      BigNumber.from(rateOracleConfig.rateOracleBufferSize).toNumber(),
      rateOracleConfig.minSecondsSinceLastUpdate,
      maxIrsDurationInSeconds,
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

    if (existingAaveLendingPoolAddress && aaveTokens) {
      const aaveLendingPool = (await ethers.getContractAt(
        "IAaveV2LendingPool",
        existingAaveLendingPoolAddress
      )) as IAaveV2LendingPool;

      for (const tokenDefinition of aaveTokens) {
        let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

        if (tokenDefinition.daysOfTrustedDataPoints) {
          trustedDataPointsGenerator = await buildAaveDataGenerator(
            hre,
            tokenDefinition.address,
            tokenDefinition.daysOfTrustedDataPoints,
            tokenDefinition.borrow,
            { lendingPool: aaveLendingPool }
          );
        }

        await deployAndConfigureWithGenerator({
          hre,
          initialArgs: [aaveLendingPool.address, tokenDefinition.address],
          rateOracleConfig: tokenDefinition,
          contractName: tokenDefinition.borrow
            ? "AaveBorrowRateOracle"
            : "AaveRateOracle",
          trustedDataPointsGenerator,
        });
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

      let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

      if (tokenDefinition.daysOfTrustedDataPoints) {
        trustedDataPointsGenerator = await buildCompoundDataGenerator(
          hre,
          cToken.address,
          tokenDefinition.daysOfTrustedDataPoints,
          tokenDefinition.borrow,
          ethPool
        );
      }

      await deployAndConfigureWithGenerator({
        hre,
        initialArgs: [
          cToken.address,
          ethPool,
          underlyingAddress,
          underlyingDecimals,
        ],
        rateOracleConfig: tokenDefinition,
        contractName: tokenDefinition.borrow
          ? "CompoundBorrowRateOracle"
          : "CompoundRateOracle",
        trustedDataPointsGenerator,
      });
    }
  }
  // End of Compound Rate Oracles

  // Lido Rate Oracle
  const lidoConfig = deployConfig.lidoConfig;
  const lidoStETHAddress = lidoConfig?.lidoStETH;
  const lidoOracleAddress = lidoConfig?.lidoOracle;

  if (lidoStETHAddress) {
    let wethAddress: string;
    if (deployConfig.weth) {
      wethAddress = deployConfig.weth;
    } else {
      throw new Error("WETH not found");
    }

    let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

    if (lidoConfig.defaults.daysOfTrustedDataPoints) {
      trustedDataPointsGenerator = await buildLidoDataGenerator(
        hre,
        lidoConfig.defaults.daysOfTrustedDataPoints,
        {
          stEth: (await ethers.getContractAt(
            "IStETH",
            lidoStETHAddress
          )) as IStETH,
          lidoOracle: lidoOracleAddress
            ? ((await ethers.getContractAt(
                "ILidoOracle",
                lidoOracleAddress
              )) as ILidoOracle)
            : undefined,
        }
      );
    }

    await deployAndConfigureWithGenerator({
      hre,
      initialArgs: [lidoStETHAddress, lidoOracleAddress, wethAddress],
      rateOracleConfig: {
        name: null,
        rateOracleBufferSize: lidoConfig.defaults.rateOracleBufferSize,
        minSecondsSinceLastUpdate:
          lidoConfig.defaults.minSecondsSinceLastUpdate,
      },
      contractName: "LidoRateOracle",
      trustedDataPointsGenerator,
    });
  }
  // End of Lido Rate Oracle

  // RocketPool Rate Oracle
  const rocketPoolConfig = deployConfig.rocketPoolConfig;
  const rocketEthAddress = rocketPoolConfig?.rocketPoolRocketToken;
  const rocketNetworkBalancesAddress = rocketPoolConfig?.rocketNetworkBalances;

  if (rocketEthAddress && rocketNetworkBalancesAddress) {
    let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;
    const rocketEth = (await ethers.getContractAt(
      "IRocketEth",
      rocketEthAddress
    )) as IRocketEth;
    const rocketNetworkBalances = (await ethers.getContractAt(
      "IRocketNetworkBalances",
      rocketNetworkBalancesAddress
    )) as IRocketNetworkBalances;

    if (rocketPoolConfig.defaults.daysOfTrustedDataPoints) {
      trustedDataPointsGenerator = await buildRocketDataGenerator(
        hre,
        rocketPoolConfig.defaults.daysOfTrustedDataPoints,
        {
          rocketEth,
          rocketNetworkBalances,
        }
      );
    }

    await deployAndConfigureWithGenerator({
      hre,
      initialArgs: [
        rocketEth.address,
        rocketNetworkBalances.address,
        deployConfig.weth,
      ],
      rateOracleConfig: {
        name: null,
        rateOracleBufferSize: rocketPoolConfig.defaults.rateOracleBufferSize,
        minSecondsSinceLastUpdate:
          rocketPoolConfig.defaults.minSecondsSinceLastUpdate,
      },
      contractName: "RocketPoolRateOracle",
      trustedDataPointsGenerator,
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
