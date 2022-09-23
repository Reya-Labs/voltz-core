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
} from "./helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";
import "@nomiclabs/hardhat-ethers";
import { poolConfig, poolConfigs } from "../deployConfig/poolConfig";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

interface MultisigTemplateData {
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
    minMarginToIncentiviseLiquidators: BigNumberish;
  };
}

async function writeIrsCreationTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const template = fs.readFileSync(
    path.join(__dirname, "CreateIrsTransactions.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  console.log("Output:\n", output);
}

async function configureIrs(
  hre: HardhatRuntimeEnvironment,
  marginEngine: IMarginEngine,
  vamm: IVAMM,
  poolConfig: poolConfig,
  s?: SignerWithAddress
) {
  // Set the config for our IRS instance
  // TODO: allow values to be overridden with task parameters, as required
  console.log(`Configuring IRS...`);

  if (!s) {
    throw new Error("no signer");
  }

  let trx = await marginEngine
    .connect(s)
    .setMarginCalculatorParameters(poolConfig.marginCalculatorParams, {
      gasLimit: 10000000,
    });
  await trx.wait();
  trx = await marginEngine
    .connect(s)
    .setCacheMaxAgeInSeconds(poolConfig.cacheMaxAgeInSeconds, {
      gasLimit: 10000000,
    });
  await trx.wait();
  trx = await marginEngine
    .connect(s)
    .setLookbackWindowInSeconds(poolConfig.lookbackWindowInSeconds, {
      gasLimit: 10000000,
    });
  await trx.wait();
  trx = await marginEngine
    .connect(s)
    .setLiquidatorReward(poolConfig.liquidatorRewardWad, {
      gasLimit: 10000000,
    });
  await trx.wait();

  const currentVammVars = await vamm.vammVars();
  const currentFeeProtocol = currentVammVars.feeProtocol;
  if (currentFeeProtocol === 0) {
    // Fee protocol can only be set if it has never been set
    trx = await vamm.connect(s).setFeeProtocol(poolConfig.vammFeeProtocolWad, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  const currentFeeWad = await vamm.feeWad();
  if (currentFeeWad.toString() === "0") {
    // Fee  can only be set if it has never been set
    trx = await vamm.connect(s).setFee(poolConfig.vammFeeProtocolWad, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  if (poolConfig.isAlpha) {
    const isAlphaVAMM = await vamm.isAlpha();
    if (!isAlphaVAMM) {
      trx = await vamm.connect(s).setIsAlpha(true, {
        gasLimit: 10000000,
      });
      await trx.wait();
    } else {
      console.log("VAMM is already in alpha state.");
    }

    const isAlphaME = await marginEngine.isAlpha();
    if (!isAlphaME) {
      trx = await marginEngine.connect(s).setIsAlpha(true, {
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

      trx = await periphery
        .connect(s)
        .setLPMarginCap(vamm.address, poolConfig.lpMarginCap, {
          gasLimit: 10000000,
        });
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

// TODO: adapt JSON to include IRS configuration
task(
  "createIrsInstance",
  "Calls the Factory to deploy a new Interest Rate Swap instance"
)
  .addParam("pool", "The name of the pool (e.g. 'aDAI', 'stETH', etc.)")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addOptionalParam(
    "termStartTimestamp",
    "The UNIX timestamp of pool start",
    undefined,
    types.int
  )
  .addParam("termEndTimestamp", "The UNIX timestamp of pool end")
  .setAction(async (taskArgs, hre) => {
    const addSigner = async (address: string): Promise<SignerWithAddress> => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
      });
      await hre.network.provider.send("hardhat_setBalance", [
        address,
        "0x1000000000000000000",
      ]);
      return await hre.ethers.getSigner(address);
    };

    const removeSigner = async (address: string) => {
      await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [address],
      });
    };

    const withSigner = async (
      address: string,
      f: (_: SignerWithAddress) => Promise<void>
    ) => {
      if (!(hre.network.name === "localhost")) {
        throw new Error("Only localhost");
      }

      const signer = await addSigner(address);
      await f(signer);
      await removeSigner(address);
    };

    let poolConfig: poolConfig;
    if (taskArgs.pool in poolConfigs) {
      poolConfig = poolConfigs[taskArgs.pool];
    } else {
      throw new Error(`No configuration for ${taskArgs.pool}.`);
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
    const factory = await hre.ethers.getContract("Factory");

    console.log(
      `Deploying IRS for rate oracle ${poolConfig.rateOracle} with underlying ${underlyingTokenAddress}`
    );

    const block = await hre.ethers.provider.getBlock("latest");

    let termStartTimestamp = block.timestamp;
    const termEndTimestamp = termStartTimestamp + 86400 + 3600; ////////////////////////

    if (taskArgs.termStartTimestamp) {
      termStartTimestamp = taskArgs.termStartTimestamp;
    }

    if (termStartTimestamp + 86400 > termEndTimestamp) {
      throw new Error("Unfunctional pool. Check start and end timestamps!");
    }

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
      const nonce = await getFactoryNonce(hre, factory.address);

      const data: MultisigTemplateData = {
        factoryAddress: factory.address,
        underlyingTokenAddress: underlyingToken.address,
        rateOracleAddress: rateOracle.address,
        termStartTimestampWad: toBn(termStartTimestamp),
        termEndTimestampWad: toBn(termEndTimestamp),
        tickSpacing: poolConfig.tickSpacing,
        predictedMarginEngineAddress: ethers.utils.getContractAddress({
          from: factory.address,
          nonce: nonce,
        }),
        predictedVammAddress: ethers.utils.getContractAddress({
          from: factory.address,
          nonce: nonce + 1,
        }),
        peripheryAddress: await factory.periphery(),
        cacheMaxAgeInSeconds: poolConfig.cacheMaxAgeInSeconds,
        lookbackWindowInSeconds: poolConfig.lookbackWindowInSeconds,
        feeWad: poolConfig.feeWad,
        lpMarginCap: poolConfig.lpMarginCap,
        marginCalculatorParams: poolConfig.marginCalculatorParams,
        liquidatorRewardWad: poolConfig.liquidatorRewardWad,
      };
      writeIrsCreationTransactionsToGnosisSafeTemplate(data);
    } else {
      await withSigner(await factory.owner(), async (s) => {
        const deployTrx = await factory.connect(s).deployIrsInstance(
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

          await configureIrs(hre, marginEngine, vamm, poolConfig, s);
        }
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
    let poolConfig: poolConfig;
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

  let csvOutput = `underlyingToken,rateOracle,termStartTimestamp,termEndTimestamp,termStartDate,termEndDate,tickSpacing,marginEngine,VAMM,FCM,yieldBearingProtocolID,lookbackWindowInSeconds,cacheMaxAgeInSeconds,historicalAPY`;

  for (const e of events) {
    const a = e.args;
    const startTimestamp = a.termStartTimestampWad.div(toBn(1)).toNumber();
    const endTimestamp = a.termEndTimestampWad.div(toBn(1)).toNumber();
    // const startTimeString = new Date(startTimestamp * 1000)
    //   .toISOString()
    //   .substring(0, 10);
    // const endTImeString = new Date(endTimestamp * 1000)
    //   .toISOString()
    //   .substring(0, 10);
    const startTimeString = new Date(startTimestamp * 1000).toISOString();
    const endTImeString = new Date(endTimestamp * 1000).toISOString();

    const marginEngine = await hre.ethers.getContractAt(
      "MarginEngine",
      a.marginEngine
    );
    const secondsAgo = await marginEngine.lookbackWindowInSeconds();
    const historicalAPY = await marginEngine.getHistoricalApyReadOnly();
    const cacheMaxAgeInSeconds = await marginEngine.cacheMaxAgeInSeconds();

    csvOutput += `\n${a.underlyingToken},${
      a.rateOracle
    },${startTimestamp},${endTimestamp},${startTimeString},${endTImeString},${
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
