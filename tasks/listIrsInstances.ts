import { task } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { Factory } from "../typechain";

task(
  "listIrsInstances",
  "Lists IRS instances deployed by the current factory"
).setAction(async (taskArgs, hre) => {
  const factory = (await hre.ethers.getContract("Factory")) as Factory;
  // console.log(`Listing IRS instances created by Factory ${factory.address}`);

  const logs = await factory.queryFilter(factory.filters.IrsInstance());
  const events = logs.map((l) => factory.interface.parseLog(l));

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

module.exports = {};
