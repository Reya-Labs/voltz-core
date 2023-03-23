import { task, types } from "hardhat/config";
import { getConfig } from "../deployConfig/config";
import { toBn } from "../test/helpers/toBn";
import {
  MarginEngine,
  VAMM,
  Factory,
  IMarginEngine,
  IVAMM,
  Periphery,
  IERC20Minimal,
} from "../typechain";
import { BigNumberish, ethers, utils } from "ethers";
import {
  getIRSByMarginEngineAddress,
  getRateOracleByNameOrAddress,
  getIrsInstanceEvents,
} from "./utils/helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";
import { SinglePoolConfiguration } from "../poolConfigs/pool-configs/types";
import { getNetworkPoolConfigs } from "../poolConfigs/pool-configs/poolConfig";
import { getNetworkPausers } from "../poolConfigs/pausers/pausers";

interface SingleIrsData {
  factoryAddress: string;
  predictedMarginEngineAddress: string;
  predictedVammAddress: string;
  peripheryAddress: string;
  underlyingTokenAddress: string;
  rateOracleAddress: string;
  termStartTimestampWad: BigNumberish;
  termEndTimestampWad: BigNumberish;
  tickSpacing: number;
  cacheMaxAgeInSeconds: number;
  lookbackWindowInSeconds: number;
  liquidatorRewardWad: BigNumberish;
  feeWad: BigNumberish;
  isAlpha: boolean;
  lpMarginCap: BigNumberish;
  marginCalculatorParams: {
    apyUpperMultiplierWad: BigNumberish;
    apyLowerMultiplierWad: BigNumberish;
    sigmaSquaredWad: BigNumberish;
    alphaWad: BigNumberish;
    betaWad: BigNumberish;
    xiUpperWad: BigNumberish;
    xiLowerWad: BigNumberish;
    tMaxWad: BigNumberish;
    etaIMWad: BigNumberish;
    etaLMWad: BigNumberish;
    gap1: BigNumberish;
    gap2: BigNumberish;
    gap3: BigNumberish;
    gap4: BigNumberish;
    gap5: BigNumberish;
    gap6: BigNumberish;
    gap7: BigNumberish;
    minMarginToIncentiviseLiquidators: BigNumberish;
  };
  last: boolean; // Used to stop adding commas in JSON template
}

interface MultisigTemplateData {
  multisig: string;
  chainId: string;
  pausers: {
    pauser: string;
  }[];
  irsInstances: SingleIrsData[];
}

async function writeIrsCreationTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const template = fs.readFileSync(
    path.join(__dirname, "templates/createIrsTransactions.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const jsonDir = path.join(__dirname, "JSONs");
  const outFile = path.join(
    jsonDir,
    `${data.chainId}-createIrsTransactions.json`
  );
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
  }
  fs.writeFileSync(outFile, output);

  console.log("Output written to ", outFile.toString());
}

let builtMapOfRateOracles = false;
const mapOfRateOracleAddressesToNames = new Map<string, string>();

// gets the verified contract type of a given address from etherscan
async function getContractName(
  hre: HardhatRuntimeEnvironment,
  address: string
) {
  if (!builtMapOfRateOracles) {
    for (const rateOracleType of [
      "AaveRateOracle",
      "AaveBorrowRateOracle",
      "CompoundRateOracle",
      "CompoundBorrowRateOracle",
      "LidoRateOracle",
      "RocketPoolRateOracle",
    ]) {
      for (const underlying of [
        "",
        "USDC",
        "USDT",
        "DAI",
        "ETH",
        "WETH",
        "cDAI",
        "cUSDT",
      ]) {
        const contractName = underlying
          ? `${rateOracleType}_${underlying}`
          : rateOracleType;
        try {
          const contractAddress = (await hre.ethers.getContract(contractName))
            .address;
          mapOfRateOracleAddressesToNames.set(
            contractAddress.toLowerCase(),
            contractName
          );
        } catch (e) {
          // Ignore this combination; not all combinations are deployed
        }
      }
    }
    builtMapOfRateOracles = true;
  }

  if (mapOfRateOracleAddressesToNames.has(address.toLowerCase())) {
    return mapOfRateOracleAddressesToNames.get(address.toLowerCase());
  } else {
    return "<unknown>";
  }
}

async function configureIrs(
  hre: HardhatRuntimeEnvironment,
  marginEngine: IMarginEngine,
  vamm: IVAMM,
  poolConfig: SinglePoolConfiguration
) {
  // Set the config for our IRS instance
  // TODO: allow values to be overridden with task parameters, as required
  console.log(`Configuring IRS...`);

  let trx = await marginEngine.setMarginCalculatorParameters(
    poolConfig.marginCalculatorParams,
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await marginEngine.setCacheMaxAgeInSeconds(
    poolConfig.cacheMaxAgeInSeconds,
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await marginEngine.setLookbackWindowInSeconds(
    poolConfig.lookbackWindowInSeconds,
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await marginEngine.setLiquidatorReward(poolConfig.liquidatorRewardWad, {
    gasLimit: 10000000,
  });
  await trx.wait();

  const currentVammVars = await vamm.vammVars();
  const currentFeeProtocol = currentVammVars.feeProtocol;
  if (currentFeeProtocol === 0) {
    // Fee protocol can only be set if it has never been set
    trx = await vamm.setFeeProtocol(poolConfig.vammFeeProtocolWad, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  const currentFeeWad = await vamm.feeWad();
  if (currentFeeWad.toString() === "0") {
    // Fee  can only be set if it has never been set
    trx = await vamm.setFee(poolConfig.vammFeeProtocolWad, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  if (poolConfig.isAlpha) {
    const isAlphaVAMM = await vamm.isAlpha();
    if (!isAlphaVAMM) {
      trx = await vamm.setIsAlpha(true, {
        gasLimit: 10000000,
      });
      await trx.wait();
    } else {
      console.log("VAMM is already in alpha state.");
    }

    const isAlphaME = await marginEngine.isAlpha();
    if (!isAlphaME) {
      trx = await marginEngine.setIsAlpha(true, {
        gasLimit: 10000000,
      });
      await trx.wait();
    } else {
      console.log("Margin Engine is already in alpha state.");
    }

    const factory = await hre.ethers.getContract("Factory");
    const peripheryAddress = await factory.periphery();
    const periphery = (await hre.ethers.getContractAt(
      "Periphery",
      peripheryAddress
    )) as Periphery;

    const currentLpMarginCap = await periphery.lpMarginCaps(vamm.address);
    if (currentLpMarginCap.toString() !== poolConfig.lpMarginCap) {
      console.log(`Setting margin cap to: ${poolConfig.lpMarginCap}`);

      trx = await periphery.setLPMarginCap(
        vamm.address,
        poolConfig.lpMarginCap,
        {
          gasLimit: 10000000,
        }
      );
      await trx.wait();
    }

    const newLpMarginCap = await periphery.lpMarginCaps(vamm.address);
    console.log("Margin Cap is set to: ", newLpMarginCap.toString());
  }

  console.log(`IRS configured.`);

  try {
    await marginEngine.getHistoricalApy();
    const historicalApy = await marginEngine.getHistoricalApyReadOnly();
    console.log(
      `Margin Engine's historical apy: ${historicalApy} (${utils.formatEther(
        historicalApy
      )})`
    );
  } catch (e) {
    console.error(
      `WARNING: Could not get historical APY; misconfigured window or uninitialized rate oracle?`
    );
    console.log(
      `Lookback window = ${await marginEngine.lookbackWindowInSeconds()}s`
    );
  }
}

// Description:
//   This task generates tx json for multisig to deploy and configure pool if --multisig flag is set;
//   otherwise, it will send the transactions directly.

// Example:
//   ``npx hardhat createIrsInstances --network arbitrum --multisig glpETH_v2``

// Commands for Q2.1 rollover:
// ``npx hardhat createIrsInstances --network mainnet --multisig aUSDC_v12 aUSDC_v13 borrow_aUSDC_v2 stETH_v3 rETH_v3 borrow_aETH_v3 borrow_cUSDT_v2 borrow_aUSDT_v2``
// ``npx hardhat createIrsInstances --network arbitrum --multisig aUSDC_v2 borrow_aUSDC_v2``

task(
  "createIrsInstances",
  "Calls the Factory to deploy a new Interest Rate Swap instance"
)
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addVariadicPositionalParam(
    "pools",
    "The names of pools in deployConfig/poolConfig.ts ('borrow_aDAI_v2 stETH_v1' - skip param name)"
  )
  .setAction(async (taskArgs, hre) => {
    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    const poolConfigList: SinglePoolConfiguration[] = [];
    const multisigTemplateData: SingleIrsData[] = [];

    const poolConfigs = getNetworkPoolConfigs(hre.network.name);

    // Validate all pool inputs before processing any
    for (const pool of taskArgs.pools) {
      if (pool in poolConfigs) {
        poolConfigList.push(poolConfigs[pool]);
      } else {
        throw new Error(`No configuration for ${pool}.`);
      }
    }

    // Get current timestamp
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentTime = currentBlock.timestamp;

    const factory = await hre.ethers.getContract("Factory");
    let nextFactoryNonce = await getFactoryNonce(hre, factory.address);

    for (const poolConfig of poolConfigList) {
      const termStartTimestamp = poolConfig.termStartTimestamp;
      const termEndTimestamp = poolConfig.termEndTimestamp;

      if (
        termStartTimestamp + 86400 > termEndTimestamp ||
        currentTime > termEndTimestamp
      ) {
        throw new Error("Unfunctional pool. Check start and end timestamps!");
      }

      const rateOracle = await getRateOracleByNameOrAddress(
        hre,
        poolConfig.rateOracle
      );

      const underlyingTokenAddress = await rateOracle.underlying();
      const underlyingToken = (await hre.ethers.getContractAt(
        "IERC20Minimal",
        underlyingTokenAddress
      )) as IERC20Minimal;

      console.log(
        `Deploying IRS for rate oracle ${poolConfig.rateOracle} with underlying ${underlyingTokenAddress}`
      );

      const maxIrsDurationInSeconds = getConfig(
        hre.network.name
      ).maxIrsDurationInSeconds;

      if (maxIrsDurationInSeconds < termEndTimestamp - termStartTimestamp) {
        throw new Error(
          `Rate Oracle buffer can cope with IRS instances of up to ${maxIrsDurationInSeconds} seconds duration ` +
            `so the requested duration of ${
              termEndTimestamp - termStartTimestamp
            } is unsafe`
        );
      }

      console.log(
        `Creating test IRS for mock token/rate oracle: {${underlyingToken.address}, ${rateOracle.address}}`
      );

      if (taskArgs.multisig) {
        const data: SingleIrsData = {
          factoryAddress: factory.address,
          underlyingTokenAddress: underlyingToken.address,
          rateOracleAddress: rateOracle.address,
          termStartTimestampWad: toBn(termStartTimestamp),
          termEndTimestampWad: toBn(termEndTimestamp),
          tickSpacing: poolConfig.tickSpacing,
          predictedMarginEngineAddress: ethers.utils.getContractAddress({
            from: factory.address,
            nonce: nextFactoryNonce++,
          }),
          predictedVammAddress: ethers.utils.getContractAddress({
            from: factory.address,
            nonce: nextFactoryNonce++,
          }),
          peripheryAddress: await factory.periphery(),
          cacheMaxAgeInSeconds: poolConfig.cacheMaxAgeInSeconds,
          lookbackWindowInSeconds: poolConfig.lookbackWindowInSeconds,
          feeWad: poolConfig.feeWad,
          isAlpha: poolConfig.isAlpha,
          lpMarginCap: poolConfig.lpMarginCap,
          marginCalculatorParams: poolConfig.marginCalculatorParams,
          liquidatorRewardWad: poolConfig.liquidatorRewardWad,
          last: false,
        };

        const masterFcmAddress = await factory.masterFCMs(
          await rateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID()
        );
        if (masterFcmAddress !== ethers.constants.AddressZero) {
          // The factory will also create an FCM proxy, so increment the nonce for that
          nextFactoryNonce++;
        }

        multisigTemplateData.push(data);
      } else {
        const deployTrx = await factory.deployIrsInstance(
          underlyingToken.address,
          rateOracle.address,
          toBn(termStartTimestamp), // converting to wad
          toBn(termEndTimestamp), // converting to wad
          poolConfig.tickSpacing,
          { gasLimit: 10000000 }
        );
        const receipt = await deployTrx.wait();
        // console.log(receipt);

        if (!receipt.status) {
          console.error("IRS creation failed!");
        } else {
          const event = receipt.events.filter(
            (e: { event: string }) => e.event === "IrsInstance"
          )[0];
          //   console.log(`event: ${JSON.stringify(event, null, 2)}`);
          console.log(
            `IRS created successfully. Event args were: ${event.args}`
          );

          const marginEngineAddress = event.args[5];
          const vammAddress = event.args[6];

          const marginEngine = (await hre.ethers.getContractAt(
            "MarginEngine",
            marginEngineAddress
          )) as MarginEngine;
          const vamm = (await hre.ethers.getContractAt(
            "VAMM",
            vammAddress
          )) as VAMM;

          await configureIrs(hre, marginEngine, vamm, poolConfig);
        }
      }
    }

    if (taskArgs.multisig && multisigTemplateData.length > 0) {
      const voltzPausabilityWrapper = await hre.ethers.getContract(
        "VoltzPausabilityWrapper"
      );

      multisigTemplateData[multisigTemplateData.length - 1].last = true;
      writeIrsCreationTransactionsToGnosisSafeTemplate({
        irsInstances: multisigTemplateData,
        pausers: getNetworkPausers(hre.network.name)
          .concat([voltzPausabilityWrapper.address])
          .map((p) => ({
            pauser: p,
          })),
        multisig,
        chainId: await hre.getChainId(),
      });
    }
  });

task(
  "resetIrsConfigToDefault",
  "Resets the configuration of a Margin Engine and its VAMM to the configured defaults from poolConfig"
)
  .addParam("marginEngine", "The address of the margin engine")
  .addParam("pool", "The name of the pool (e.g. 'aDAI', 'stETH', etc.)")
  .setAction(async (taskArgs, hre) => {
    const poolConfigs = getNetworkPoolConfigs(hre.network.name);

    let poolConfig: SinglePoolConfiguration;
    if (taskArgs.pool in poolConfigs) {
      poolConfig = poolConfigs[taskArgs.pool];
    } else {
      throw new Error(`No configuration for ${taskArgs.pool}.`);
    }

    const { marginEngine, vamm } = await getIRSByMarginEngineAddress(
      hre,
      taskArgs.marginEngine
    );

    await configureIrs(hre, marginEngine, vamm, poolConfig);
  });

task(
  "listIrsInstances",
  "Lists IRS instances deployed by the current factory"
).setAction(async (taskArgs, hre) => {
  const events = await getIrsInstanceEvents(hre);

  let csvOutput = `underlyingToken,rateOracle,rateOracleType,termStartTimestamp,termEndTimestamp,termStartDate,termEndDate,tickSpacing,marginEngine,VAMM,FCM,yieldBearingProtocolID,lookbackWindowInSeconds,cacheMaxAgeInSeconds,historicalAPY`;

  for (const e of events) {
    const a = e.args;
    const startTimestamp = a.termStartTimestampWad.div(toBn(1)).toNumber();
    const endTimestamp = a.termEndTimestampWad.div(toBn(1)).toNumber();
    const startTimeString = new Date(startTimestamp * 1000).toISOString();
    const endTImeString = new Date(endTimestamp * 1000).toISOString();

    const marginEngine = await hre.ethers.getContractAt(
      "MarginEngine",
      a.marginEngine
    );
    const secondsAgo = await marginEngine.lookbackWindowInSeconds();
    const historicalAPY = await marginEngine.getHistoricalApyReadOnly();
    const cacheMaxAgeInSeconds = await marginEngine.cacheMaxAgeInSeconds();

    // We get the latest rate oracle because it could have changed since the log was written
    const rateOracleAddress = await marginEngine.rateOracle();
    const rateOracleType = await getContractName(hre, rateOracleAddress);

    csvOutput += `\n${
      a.underlyingToken
    },${rateOracleAddress},${rateOracleType},${startTimestamp},${endTimestamp},${startTimeString},${endTImeString},${
      a.tickSpacing
    },${a.marginEngine},${a.vamm},${a.fcm},${
      a.yieldBearingProtocolID
    },${secondsAgo.toString()},${cacheMaxAgeInSeconds.toString()},${historicalAPY.toString()}`;
  }

  console.log(csvOutput);
});

async function getFactoryNonce(
  hre: HardhatRuntimeEnvironment,
  factoryAddress: string
) {
  let nonce = await hre.ethers.provider.getTransactionCount(factoryAddress);
  if (nonce === 0) {
    // Contract nonces start at 1
    nonce++;
  }
  return nonce;
}

task(
  "predictIrsAddresses",
  "Predicts the IRS addresses used by a not-yet-created IRS instance"
)
  .addParam(
    "fcm",
    "True if an FCM will be deployed; false if not (this affects future addresses)",
    true,
    types.boolean
  )
  .addOptionalParam("factory", "Factory address (defaults to deployments data)")
  .setAction(async (taskArgs, hre) => {
    let factoryAddress;

    if (taskArgs.factory) {
      factoryAddress = taskArgs.factory;
    } else {
      const factory = (await hre.ethers.getContract("Factory")) as Factory;
      factoryAddress = factory.address;
    }

    const nonce = await getFactoryNonce(hre, factoryAddress);

    console.log("Past addresses:");
    for (let i = 1; i < nonce; i++) {
      const address = ethers.utils.getContractAddress({
        from: factoryAddress,
        nonce: i,
      });
      console.log(`(${i})`.padStart(6) + ` ${address}`);
    }

    const nextMarginEngine = await ethers.utils.getContractAddress({
      from: factoryAddress,
      nonce: nonce,
    });
    const nextVAMM = await ethers.utils.getContractAddress({
      from: factoryAddress,
      nonce: nonce + 1,
    });

    console.log(
      `Next MarginEngine (nonce=${nonce}) will be at ${nextMarginEngine}`
    );
    console.log(`Next VAMM (nonce=${nonce + 1}) will be at ${nextVAMM}`);
    if (taskArgs.fcm) {
      const nextFCM = await ethers.utils.getContractAddress({
        from: factoryAddress,
        nonce: nonce + 2,
      });
      console.log(`Next FCM (nonce=${nonce + 2}) will be at ${nextFCM}`);
    }
  });

task(
  "pauseAllIrsInstances",
  "Pause all IRS instances deployed by the current factory"
)
  .addParam(
    "pause",
    "True to pause; false to unpause",
    undefined,
    types.boolean
  )
  .setAction(async (taskArgs, hre) => {
    const events = await getIrsInstanceEvents(hre);

    if (taskArgs.pause) {
      console.log(
        `PAUSING ${events.length} IRS instances on network ${hre.network.name}.`
      );
      console.log(`THESE INSTANCES WILL BECOME UNUSABLE.`);
    } else {
      console.log(
        `UNpausing ${events.length} IRS instances. They will be usable again.`
      );
    }

    const prompts = require("prompts");
    const response = await prompts({
      type: "confirm",
      name: "proceed",
      message: "Are you sure you wish to continue?",
    });

    console.log("response", response.proceed);

    if (response.proceed) {
      for (const e of events) {
        const a = e.args;
        const vamm = await hre.ethers.getContractAt("VAMM", a.vamm);
        const isPaused = await vamm.paused();

        if (isPaused === taskArgs.pause) {
          console.log(
            `VAMM at ${vamm.address} is already ${
              isPaused ? "paused" : "unpaused"
            }.`
          );
        } else {
          process.stdout.write(
            `${taskArgs.pause ? "Pausing" : "Unpausing"} VAMM at ${
              vamm.address
            }...`
          );
          const trx = await vamm.setPausability(taskArgs.pause);
          await trx.wait();
          console.log(" done.");
        }
      }
    }
  });

module.exports = {};
