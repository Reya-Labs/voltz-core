import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";
import {
  applyBufferConfig,
  RateOracleConfigForTemplate,
} from "../deployConfig/utils";
import { BaseRateOracle, ERC20 } from "../typechain";
import { BigNumber } from "ethers";
import path from "path";
import mustache from "mustache";
import { Datum } from "../historicalData/generators/common";
import { buildAaveDataGenerator } from "../historicalData/generators/aave";
import { buildCompoundDataGenerator } from "../historicalData/generators/compound";

import { buildLidoDataGenerator } from "../historicalData/generators/lido";
import { buildRocketDataGenerator } from "../historicalData/generators/rocket";
import { buildGlpDataGenerator } from "../historicalData/generators/glp";
import {
  getBlockAtTimestamp,
  getEstimatedBlocksPerDay,
} from "../tasks/utils/helpers";
import { ONE_DAY_IN_SECONDS } from "../tasks/utils/constants";
import { buildSofrDataGenerator } from "../historicalData/generators/sofr";

interface RateOracleConfigTemplateData {
  chainId: string;
  multisig: string;
  rateOracles: RateOracleConfigForTemplate[];
}

async function writeRateOracleConfigToGnosisSafeTemplate(
  data: RateOracleConfigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "tasks",
      "templates/rateOracleConfig.json.mustache"
    ),
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
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const multisig = deployConfig.multisig;

  // Get the maxIrsDuration (used to sanity check buffer size)
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
    let lastCummulativeReward = BigNumber.from(0);
    let lastEthGlpPrice = BigNumber.from(0);

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
        if (data.glpData) {
          lastCummulativeReward = data.glpData.lastCummulativeReward;
          lastEthGlpPrice = data.glpData.lastEthGlpPrice;
        }
      }

      // console.log(
      //   `Got historical data (from generator): ${JSON.stringify(
      //     timestamps
      //   )}, ${JSON.stringify((rates as BigNumber[]).map((r) => r.toString()))}`
      // );

      // We skip the most recent timestamp & rate, since it should be from ~now and the contract will write this itself
      // only applied if Oracle is not GLP (this oracle doesn't get latest update in constructor)
      if (lastCummulativeReward.eq(0) && lastEthGlpPrice.eq(0)) {
        timestamps = timestamps.slice(0, -1);
        rates = rates.slice(0, -1);
      }
    }

    let args = [...initialArgs, timestamps, rates];
    if (lastCummulativeReward.gt(0) && lastEthGlpPrice.gt(0)) {
      args = [...args, lastEthGlpPrice, lastCummulativeReward];
    }
    console.log(`Deployment args are ${args.map((a) => a.toString())}`);

    await deploy(rateOracleIdentifier, {
      contract: contractName,
      from: deployer,
      args: args,
      log: doLogging,
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

  if (multisig && multisig.toLowerCase() !== ownerOfRateOracle.toLowerCase()) {
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

const getBlockSpec = async (
  hre: HardhatRuntimeEnvironment,
  daysOfTrustedDataPoints: number
): Promise<{
  fromBlock: number;
  toBlock: number;
  blockInterval: number;
}> => {
  const currentBlock = await hre.ethers.provider.getBlock("latest");

  const toBlock = currentBlock.number;
  const fromBlock = await getBlockAtTimestamp(
    hre,
    currentBlock.timestamp - ONE_DAY_IN_SECONDS * daysOfTrustedDataPoints
  );
  const blockInterval = await getEstimatedBlocksPerDay(
    hre,
    daysOfTrustedDataPoints
  );

  return {
    fromBlock,
    toBlock,
    blockInterval,
  };
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name;
  const deployConfig = getConfig(network);

  {
    // Aave v2 Rate Oracles
    // Configure these if we have a lending pool and one or more tokens configured
    const aaveConfig = deployConfig.aaveConfig;
    const existingAaveLendingPoolAddress = aaveConfig?.aaveLendingPool;
    const existingAaveLendingPoolDeploymentBlock =
      aaveConfig?.aaveLendingPoolDeploymentBlock;
    const aaveTokens = aaveConfig?.aaveTokens;

    if (
      existingAaveLendingPoolAddress &&
      existingAaveLendingPoolDeploymentBlock &&
      aaveTokens
    ) {
      for (const tokenDefinition of aaveTokens) {
        let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

        if (tokenDefinition.daysOfTrustedDataPoints) {
          const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
            hre,
            tokenDefinition.daysOfTrustedDataPoints
          );

          trustedDataPointsGenerator = await buildAaveDataGenerator({
            hre,
            underlyingAddress: tokenDefinition.address,
            version: 2,
            borrow: tokenDefinition.borrow || false,
            fromBlock: fromBlock,
            toBlock: toBlock,
            blockInterval,
          });
        }

        await deployAndConfigureWithGenerator({
          hre,
          initialArgs: [
            existingAaveLendingPoolAddress,
            tokenDefinition.address,
          ],
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

  {
    // Aave v3 Rate Oracles
    // Configure these if we have a lending pool and one or more tokens configured
    const aaveConfigV3 = deployConfig.aaveConfigV3;
    const existingAaveLendingPoolAddress = aaveConfigV3?.aaveLendingPool;
    const existingAaveLendingPoolDeploymentBlock =
      aaveConfigV3?.aaveLendingPoolDeploymentBlock;
    const aaveTokens = aaveConfigV3?.aaveTokens;

    if (
      existingAaveLendingPoolAddress &&
      existingAaveLendingPoolDeploymentBlock &&
      aaveTokens
    ) {
      for (const tokenDefinition of aaveTokens) {
        let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

        if (tokenDefinition.daysOfTrustedDataPoints) {
          const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
            hre,
            tokenDefinition.daysOfTrustedDataPoints
          );

          trustedDataPointsGenerator = await buildAaveDataGenerator({
            hre,
            underlyingAddress: tokenDefinition.address,
            version: 3,
            borrow: tokenDefinition.borrow || false,
            fromBlock: fromBlock,
            toBlock: toBlock,
            blockInterval: blockInterval,
          });
        }

        await deployAndConfigureWithGenerator({
          hre,
          initialArgs: [
            existingAaveLendingPoolAddress,
            tokenDefinition.address,
          ],
          rateOracleConfig: tokenDefinition,
          contractName: tokenDefinition.borrow
            ? "AaveV3BorrowRateOracle"
            : "AaveV3RateOracle",
          trustedDataPointsGenerator,
        });
      }
    }
    // End of Aave Rate Oracles
  }

  {
    // GLP Rate Oracle
    const glpConfig = deployConfig.glpConfig;

    const existingRewardRouter = glpConfig?.rewardRouter;
    const existingRewardRouterDeploymentBlock =
      glpConfig?.rewardRouterDeploymentBlock;
    const rewardToken = glpConfig?.rewardToken;
    const daysOfTrustedDataPoints = glpConfig?.defaults.daysOfTrustedDataPoints;

    if (
      existingRewardRouter &&
      existingRewardRouterDeploymentBlock &&
      rewardToken
    ) {
      let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

      if (daysOfTrustedDataPoints) {
        const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
          hre,
          daysOfTrustedDataPoints
        );

        trustedDataPointsGenerator = await buildGlpDataGenerator({
          hre,
          fromBlock,
          toBlock,
          blockInterval,
        });
      }

      await deployAndConfigureWithGenerator({
        hre,
        initialArgs: [existingRewardRouter, rewardToken],
        rateOracleConfig: {
          name: null,
          rateOracleBufferSize: glpConfig.defaults.rateOracleBufferSize,
          minSecondsSinceLastUpdate:
            glpConfig.defaults.minSecondsSinceLastUpdate,
        },
        contractName: "GlpRateOracle",
        trustedDataPointsGenerator,
      });
    }
  }

  {
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
          const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
            hre,
            tokenDefinition.daysOfTrustedDataPoints
          );

          trustedDataPointsGenerator = await buildCompoundDataGenerator({
            hre,
            fromBlock,
            toBlock,
            blockInterval,
            cTokenAddress: tokenDefinition.address,
            isEther: tokenDefinition.name === "cETH",
            borrow: tokenDefinition.borrow || false,
          });
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
  }
  // End of Compound Rate Oracles

  // Lido Rate Oracle
  {
    const lidoConfig = deployConfig.lidoConfig;
    const lidoStETHAddress = lidoConfig?.lidoStETH;
    const lidoOracleAddress = lidoConfig?.lidoOracle;
    const daysOfTrustedDataPoints =
      lidoConfig?.defaults.daysOfTrustedDataPoints;

    if (lidoStETHAddress) {
      let wethAddress: string;
      if (deployConfig.weth) {
        wethAddress = deployConfig.weth;
      } else {
        throw new Error("WETH not found");
      }

      let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

      if (daysOfTrustedDataPoints) {
        const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
          hre,
          daysOfTrustedDataPoints
        );

        trustedDataPointsGenerator = await buildLidoDataGenerator({
          hre,
          fromBlock,
          toBlock,
          blockInterval,
        });
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
  }
  // End of Lido Rate Oracle

  // RocketPool Rate Oracle
  {
    const rocketPoolConfig = deployConfig.rocketPoolConfig;
    const rocketEthAddress = rocketPoolConfig?.rocketPoolRocketToken;
    const rocketNetworkBalancesAddress =
      rocketPoolConfig?.rocketNetworkBalances;
    const daysOfTrustedDataPoints =
      rocketPoolConfig?.defaults.daysOfTrustedDataPoints;

    if (rocketEthAddress && rocketNetworkBalancesAddress) {
      let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

      if (daysOfTrustedDataPoints) {
        const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
          hre,
          daysOfTrustedDataPoints
        );

        trustedDataPointsGenerator = await buildRocketDataGenerator({
          hre,
          fromBlock,
          toBlock,
          blockInterval,
        });
      }

      await deployAndConfigureWithGenerator({
        hre,
        initialArgs: [
          rocketEthAddress,
          rocketNetworkBalancesAddress,
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
  }
  // End of Rocket Pool Rate Oracle

  // SOFR Rate Oracle
  {
    const sofrConfig = deployConfig.sofrConfig;
    const sofrIndexValue = sofrConfig?.sofrIndexValue;
    const sofrIndexEffectiveDate = sofrConfig?.sofrIndexEffectiveDate;
    const tokens = sofrConfig?.tokens;

    if (sofrIndexValue && sofrIndexEffectiveDate && tokens) {
      for (const tokenDefinition of tokens) {
        let trustedDataPointsGenerator: AsyncGenerator<Datum> | null = null;

        if (tokenDefinition.daysOfTrustedDataPoints) {
          const { fromBlock, toBlock, blockInterval } = await getBlockSpec(
            hre,
            tokenDefinition.daysOfTrustedDataPoints
          );

          trustedDataPointsGenerator = await buildSofrDataGenerator({
            hre,
            rate: "sofr-offchain",
            fromBlock: fromBlock,
            toBlock: toBlock,
            blockInterval,
          });
        }

        await deployAndConfigureWithGenerator({
          hre,
          initialArgs: [
            sofrIndexValue,
            sofrIndexEffectiveDate,
            tokenDefinition.address,
          ],
          rateOracleConfig: tokenDefinition,
          contractName: "SofrRateOracle",
          trustedDataPointsGenerator,
        });
      }
    }
  }
  // End of SOFR Rate Oracle

  if (multisigConfig.length > 0) {
    // Flag the last entry to tell the template to stop adding commas
    multisigConfig[multisigConfig.length - 1].last = true;
    await writeRateOracleConfigToGnosisSafeTemplate({
      chainId: await hre.getChainId(),
      multisig: deployConfig.multisig,
      rateOracles: multisigConfig,
    });
  }

  return false; // This script is safely re-runnable and will try to reconfigure existing rate oracles if required
};
func.tags = ["RateOracles"];
func.id = "RateOracles";
export default func;
