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
  BaseRateOracle,
} from "../typechain";
import { BigNumberish, ethers, utils } from "ethers";
import {
  getIRSByMarginEngineAddress,
  getRateOracleByNameOrAddress,
  getIrsInstanceEvents,
} from "./helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IrsConfigDefaults } from "../deployConfig/types";
import mustache from "mustache";
import * as fs from "fs";
import path from "path";

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

async function getLpMarginCap(
  hre: HardhatRuntimeEnvironment,
  rateOracle: BaseRateOracle,
  stableUnderlying: boolean
) {
  const underlyingTokenAddress = await rateOracle.underlying();
  const underlyingToken = (await hre.ethers.getContractAt(
    "IERC20Minimal",
    underlyingTokenAddress
  )) as IERC20Minimal;

  // defaults to eth value because it's lower
  let lpMarginCapUnscaled = getConfig(hre.network.name).irsConfig.lpMarginCap
    .eth;
  if (stableUnderlying) {
    lpMarginCapUnscaled = getConfig(hre.network.name).irsConfig.lpMarginCap
      .stableCoin;
  }

  const decimals = await underlyingToken.decimals();
  const lpMarginCap = toBn(lpMarginCapUnscaled, decimals);

  return lpMarginCap;
}

async function configureIrs(
  hre: HardhatRuntimeEnvironment,
  marginEngine: IMarginEngine,
  vamm: IVAMM,
  config: IrsConfigDefaults,
  isAlpha?: boolean,
  stableUnderlying?: boolean,
  rateOracle?: BaseRateOracle
) {
  // Set the config for our IRS instance
  // TODO: allow values to be overridden with task parameters, as required
  console.log(`Configuring IRS...`);

  let trx = await marginEngine.setMarginCalculatorParameters(
    config.marginEngineCalculatorParameters,
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await marginEngine.setCacheMaxAgeInSeconds(
    config.marginEngineCacheMaxAgeInSeconds,
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await marginEngine.setLookbackWindowInSeconds(
    config.marginEngineLookbackWindowInSeconds,
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await marginEngine.setLiquidatorReward(
    config.marginEngineLiquidatorRewardWad,
    { gasLimit: 10000000 }
  );
  await trx.wait();

  const currentVammVars = await vamm.vammVars();
  const currentFeeProtocol = currentVammVars.feeProtocol;
  if (currentFeeProtocol === 0) {
    // Fee protocol can only be set if it has never been set
    trx = await vamm.setFeeProtocol(config.vammFeeProtocol, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  const currentFeeWad = await vamm.feeWad();
  if (currentFeeWad.toString() === "0") {
    // Fee  can only be set if it has never been set
    trx = await vamm.setFee(config.vammFeeWad, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  // TODO: catch this for multisig too
  if (isAlpha && rateOracle !== undefined && stableUnderlying !== undefined) {
    const isAlphaVAMM = await vamm.isAlpha();
    if (!isAlphaVAMM) {
      trx = await vamm.setIsAlpha(true, {
        gasLimit: 10000000,
      });
      await trx.wait();
    } else {
      console.log("IsAlpha is already set in VAMM");
    }

    const isAlphaME = await marginEngine.isAlpha();
    if (!isAlphaME) {
      trx = await marginEngine.setIsAlpha(true, {
        gasLimit: 10000000,
      });
      await trx.wait();
    } else {
      console.log("IsAlpha is already set in Margin Engine");
    }

    const factory = await hre.ethers.getContract("Factory");
    const peripheryAddress = await factory.periphery();
    const periphery = (await hre.ethers.getContractAt(
      "Periphery",
      peripheryAddress
    )) as Periphery;

    const lpMarginCap = await getLpMarginCap(hre, rateOracle, stableUnderlying);

    const lpMarginCapCurrent = await periphery.lpMarginCaps(vamm.address);
    if (lpMarginCapCurrent.toString() !== lpMarginCap.toString()) {
      console.log("Setting margin cap to: ", lpMarginCap.toString());
      trx = await periphery.setLPMarginCap(vamm.address, lpMarginCap, {
        gasLimit: 10000000,
      });
      await trx.wait();
    }
    const newLpMarginCap = await periphery.lpMarginCaps(vamm.address);
    console.log("Margin Cap was set at: ", newLpMarginCap.toString());
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
  .addParam(
    "rateOracle",
    "The name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addOptionalParam(
    "daysDuration",
    "The number of days between the start and end time of the IRS contract",
    30,
    types.int
  )
  .addOptionalParam(
    "tickSpacing",
    "The tick spacing for the VAMM",
    60,
    types.int
  )
  .addFlag(
    "isAlpha",
    "If set, pool is in alpha state and an LP margin cap is set in periphery"
  )
  .addFlag(
    "stableUnderlying",
    "If set, LP margin cap gets the value for stable coin in config. Else, it defaults to value for eth pools"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    const underlyingTokenAddress = await rateOracle.underlying();
    const underlyingToken = (await hre.ethers.getContractAt(
      "IERC20Minimal",
      underlyingTokenAddress
    )) as IERC20Minimal;
    const factory = await hre.ethers.getContract("Factory");

    console.log(
      `Deploying IRS for rate oracle ${taskArgs.rateOracle} with underlying ${underlyingTokenAddress}`
    );

    const block = await hre.ethers.provider.getBlock("latest");

    const currentTimestamp = block.timestamp;
    const today = new Date(currentTimestamp * 1000);
    const tomorrow = new Date(today); // today
    tomorrow.setDate(today.getDate() + 1); // tomorrow
    tomorrow.setUTCHours(0, 0, 0, 0); // midnight tomorrow
    // ab: changed for the start timestamp to be today for testing purposes, todo: need to change back for actual deployments!
    // const startTimestamp = tomorrow.getTime() / 1000;
    const startTimestamp = today.getTime() / 1000;
    const endDay = new Date(tomorrow);

    const maxIrsDurationInDays =
      getConfig(hre.network.name).irsConfig.maxIrsDurationInSeconds /
      (60 * 60 * 24);

    if (maxIrsDurationInDays < taskArgs.daysDuration) {
      throw new Error(
        `Rate Oracle buffer can cope with IRS instances of up to ${maxIrsDurationInDays} days duration ` +
          `so the requested duration of ${taskArgs.daysDuration} is unsafe`
      );
    }

    endDay.setDate(tomorrow.getDate() + taskArgs.daysDuration);
    const endTimestamp = endDay.getTime() / 1000; // N.B. May not be midnight if clocks have changed

    console.log(
      `Creating test IRS for mock token/rate oracle: {${underlyingToken.address}, ${rateOracle.address}}`
    );

    if (taskArgs.multisig) {
      const nonce = await getFactoryNonce(hre, factory.address);

      const data = {
        factoryAddress: factory.address,
        underlyingTokenAddress: underlyingToken.address,
        rateOracleAddress: rateOracle.address,
        termStartTimestampWad: toBn(startTimestamp),
        termEndTimestampWad: toBn(endTimestamp),
        tickSpacing: taskArgs.tickSpacing,
        predictedMarginEngineAddress: await ethers.utils.getContractAddress({
          from: factory.address,
          nonce: nonce,
        }),
        predictedVammAddress: await ethers.utils.getContractAddress({
          from: factory.address,
          nonce: nonce + 1,
        }),
        peripheryAddress: await factory.periphery(),
      };
      writeIrsCreationTransactionsToGnosisSafeTemplate(data);
    } else {
      const deployTrx = await factory.deployIrsInstance(
        underlyingToken.address,
        rateOracle.address,
        toBn(startTimestamp), // converting to wad
        toBn(endTimestamp), // converting to wad
        taskArgs.tickSpacing,
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
        console.log(`IRS created successfully. Event args were: ${event.args}`);

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

        await configureIrs(
          hre,
          marginEngine,
          vamm,
          getConfig(hre.network.name).irsConfig,
          taskArgs.isAlpha,
          taskArgs.stableUnderlying,
          rateOracle
        );
      }
    }
  });

task(
  "resetIrsConfigToDefault",
  "Resets the configuration of a Margin Engine and its VAMM to the configured defaults"
)
  .addParam("marginEngine", "The address of the margin engine")
  .addFlag(
    "notAlpha",
    "If set, the pool will not have margin caps on Periphery"
  )
  .addFlag(
    "stableUnderlying",
    "If set, the value of lp margin cap is set to the config for stable coins. Else, defaults to config for eth pools"
  )
  .setAction(async (taskArgs, hre) => {
    const { marginEngine, vamm } = await getIRSByMarginEngineAddress(
      hre,
      taskArgs.marginEngine
    );

    if (!taskArgs.notAlpha) {
      await configureIrs(
        hre,
        marginEngine,
        vamm,
        getConfig(hre.network.name).irsConfig
      );
    } else {
      const rateOracleAddress = await vamm.getRateOracle();
      const rateOracle = (await hre.ethers.getContractAt(
        "BaseRateOracle",
        rateOracleAddress
      )) as BaseRateOracle;

      await configureIrs(
        hre,
        marginEngine,
        vamm,
        getConfig(hre.network.name).irsConfig,
        true,
        taskArgs.stableUnderlying,
        rateOracle
      );
    }
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
