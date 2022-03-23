import { task, types } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { IRateOracle, MarginEngine, MockAaveLendingPool } from "../typechain";
import {
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
} from "../test/shared/utilities";
import { BigNumber, utils } from "ethers";

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

    await rateOracle.increaseObservationCardinalityNext(1000);

    const aaveLendingPool = (await hre.ethers.getContractAt(
      "MockAaveLendingPool",
      "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
    )) as MockAaveLendingPool;

    for (let i = 0; i < 15; i++) {
      await hre.network.provider.send("evm_increaseTime", [86400]);
      for (let j = 0; j < 2; j++) {
        await hre.network.provider.send("evm_mine", []);
      }

      const rni =
        Math.floor((1 + (i + 1) / 3650) * 10000 + 0.5).toString() +
        "0".repeat(23);
      console.log(rni);
      await aaveLendingPool.setReserveNormalizedIncome(
        "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        rni
      );

      await rateOracle.writeOracleEntry();
    }

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

      // set margin calculator parameters
      const margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,

        devMulLeftUnwindLMWad: toBn("0.5"),
        devMulRightUnwindLMWad: toBn("0.5"),
        devMulLeftUnwindIMWad: toBn("0.8"),
        devMulRightUnwindIMWad: toBn("0.8"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0,
      };

      const marginEngineAddress = event.args[5];

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
      )) as MarginEngine;

      await marginEngine.setMarginCalculatorParameters(margin_engine_params);

      await marginEngine.setCacheMaxAgeInSeconds(BigNumber.from(86400));
      await marginEngine.setLookbackWindowInSeconds(BigNumber.from(86400 * 7));

      await marginEngine.getHistoricalApy();
      console.log(
        "historical apy",
        utils.formatEther(await marginEngine.getHistoricalApyReadOnly())
      );
    }
  });

module.exports = {};
