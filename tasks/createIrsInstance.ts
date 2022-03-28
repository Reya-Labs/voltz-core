import { task, types } from "hardhat/config";
import {
  getConfigDefaults,
  getMaxDurationOfIrsInSeconds,
} from "../deployConfig/config";
import { toBn } from "../test/helpers/toBn";
import { IRateOracle, MarginEngine, VAMM } from "../typechain";
import { utils } from "ethers";

task(
  "createIrsInstance",
  "Calls the Factory to deploy a new Interest Rate Swap instance"
)
  .addParam(
    "rateOracle",
    "The name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
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
    1000,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`Deploying IRS for rate oracle ${taskArgs.rateOracle}`);
    const rateOracle = (await hre.ethers.getContract(
      taskArgs.rateOracle
    )) as IRateOracle;
    const underlyingTokenAddress = await rateOracle.underlying();
    const underlyingToken = await hre.ethers.getContractAt(
      "IERC20Minimal",
      underlyingTokenAddress
    );
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
      getMaxDurationOfIrsInSeconds(hre.network.name) / (60 * 60 * 24);

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
    const deployTrx = await factory.deployIrsInstance(
      underlyingToken.address,
      rateOracle.address,
      toBn(startTimestamp), // converting to wad
      toBn(endTimestamp), // converting to wad
      taskArgs.tickSpacing
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

      // Set the config for our IRS instance
      // TODO: allow values to be overridden with task parameters, as required
      const configDefaults = getConfigDefaults(hre.network.name);
      let trx = await marginEngine.setMarginCalculatorParameters(
        configDefaults.marginEngineCalculatorParameters
      );
      await trx.wait();
      trx = await marginEngine.setCacheMaxAgeInSeconds(
        configDefaults.marginEngineCacheMaxAgeInSeconds
      );
      await trx.wait();
      trx = await marginEngine.setLookbackWindowInSeconds(
        configDefaults.marginEngineLookbackWindowInSeconds
      );
      await trx.wait();
      trx = await marginEngine.setLiquidatorReward(
        configDefaults.marginEngineLiquidatorRewardWad
      );
      await trx.wait();
      trx = await vamm.setFeeProtocol(configDefaults.vammFeeProtocol);
      await trx.wait();
      trx = await vamm.setFee(configDefaults.vammFeeWad);
      await trx.wait();

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
  });

module.exports = {};
