import { task, types } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { IRateOracle } from "../typechain";

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
    const startTimestamp = tomorrow.getTime() / 1000;
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
        (e: { event: string }) => e.event === "IrsInstanceDeployed"
      )[0];
      //   console.log(`event: ${JSON.stringify(event, null, 2)}`);
      console.log(`IRS created successfully. Event args were: ${event.args}`);
    }
  });

module.exports = {};
