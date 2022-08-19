import { task } from "hardhat/config";
import { utils } from "ethers";
import { getRateOracleByNameOrAddress } from "./helpers";
import { MarginEngine } from "../typechain/MarginEngine";

task(
  "writeRateOracle",
  "Writes a new datapoint for a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    // console.log(`Listing Rates known by Rate Oracle ${rateOracle.address}`);

    const trx = await rateOracle.writeOracleEntry({ gasLimit: 10000000 });
    await trx.wait();
  });

task(
  "queryRateOracle",
  "Outputs the observations stored within a named rate oracle instance"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .addFlag("latest", "Use this flag if you want only the latest entry")
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    // console.log(`Listing Rates known by Rate Oracle ${rateOracle.address}`);

    const underlying = await rateOracle.underlying();
    if (!taskArgs.latest) {
      console.log("Underlying token:", underlying);
    }

    const oracleVars = await rateOracle.oracleVars();
    // console.log(`oracleVars,${oracleVars}`);
    let csvOutput = `timestamp,value,rawTimestamp,rawValue`;
    let csvOutputLatest = ``;

    for (let i = 0; i <= oracleVars.rateIndex; i++) {
      const observation = await rateOracle.observations(i);
      const observationTimeString = new Date(
        observation.blockTimestamp * 1000
      ).toISOString();
      const observedValue = utils.formatUnits(observation.observedValue, 27);

      if (!observation.initialized) {
        throw new Error(
          `Error reading data from oracle buffer at position ${i}`
        );
      }
      csvOutput += `\n${observationTimeString},${observedValue},${observation.blockTimestamp},"${observation.observedValue}"`;
      if (i === oracleVars.rateIndex) {
        csvOutputLatest += `\n${observation.blockTimestamp}`;
      }
    }
    if (taskArgs.latest) {
      console.log(parseInt(csvOutputLatest));
    } else {
      console.log(csvOutput);
    }
  });

task(
  "queryCurrentBlockTimestamp",
  "Outputs the timestamp of the latest mined block on the ethereum blockchain"
).setAction(async (taskArgs, hre) => {
  const currentBlockTimestamp = await (
    await hre.ethers.provider.getBlock("latest")
  ).timestamp;
  console.log(currentBlockTimestamp);
  return currentBlockTimestamp;
});

// task("russianDoll", "Calling a hh task within a task").setAction(
//   async (taskArgs, hre) => {
//     const time = hre.run("queryRateOracle", {
//       rateOracle: "0x9f30ec6903f1728ca250f48f664e48c3f15038ed",
//       latest: true,
//     });
//     return time;
//   }
// );

task(
  "updateOracle",
  "Get the term start and end timestamp in WAD for the margin engine"
).setAction(async (taskArgs, hre) => {
  const marginEngineAddresses = [
    "0x654316a63e68f1c0823f0518570bc108de377831", // aDAI
    "0x0bc09825ce9433b2cdf60891e1b50a300b069dd2", // aUSDC
    "0xf2ccd85a3428d7a560802b2dd99130be62556d30", // cDAI
    "0x21f9151d6e06f834751b614c2ff40fc28811b235", // stETH
    "0xb1125ba5878cf3a843be686c6c2486306f03e301", // rETH
  ];

  // const rateOracleAddresses = [
  //   "0x65F5139977C608C6C2640c088D7fD07fA17A0614", // aDAI
  //   "0x9f30Ec6903F1728ca250f48f664e48c3f15038eD", // aUSDC
  //   "0x919674d599D8df8dd9E7Ebaabfc2881089C5D91C", // cDAI
  //   "0xA667502bF7f5dA45c7b6a70dA7f0595E6Cf342D8", // stETH
  //   "0x41EcaAC9061F6BABf2D42068F8F8dAF3BA9644FF", // rETH
  // ];

  // settable parameter for max. allowable time delta before a new write should happen (1 hour for now)
  const timeDelta = 3600;

  for (let i = 0; i < marginEngineAddresses.length; i++) {
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      marginEngineAddresses[i]
    )) as MarginEngine;

    const rateOracleAddress = await marginEngine.rateOracle();

    // sanity check
    console.log(marginEngineAddresses[i]);
    console.log("rate oracle derived from: ", await marginEngine.rateOracle());

    // get start time of margin engine i
    const termStartTimestamp = await (
      await marginEngine.termStartTimestampWad()
    )
      .div(BigInt(1e18))
      .toNumber();
    console.log("start timestamp: ", termStartTimestamp);

    // get end time of margin engine i
    const termEndTimestamp = await (await marginEngine.termEndTimestampWad())
      .div(BigInt(1e18))
      .toNumber();
    console.log("end timestamp: ", termEndTimestamp);

    // get current block timestamp i.e. time now
    const currentBlockTimestamp = await hre.run("queryCurrentBlockTimestamp");

    // get timestamp of latest rate oracle entry
    const latestOracleQueryTime = await hre.run("queryRateOracle", {
      rateOracle: rateOracleAddress, // 0x9f30ec6903f1728ca250f48f664e48c3f15038ed
      latest: true,
    });

    if (
      currentBlockTimestamp > termStartTimestamp &&
      currentBlockTimestamp - termStartTimestamp < timeDelta
    ) {
      console.log(
        "Current time is bigger than start time and delta is less than 1 hour"
      );

      if (latestOracleQueryTime >= termStartTimestamp.toString()) {
        hre.run("writeRateOracle", { rateOracle: rateOracleAddress });
        console.log("Successfully wrote to the oracle (start)");
      }
    } else {
      console.log("Did not write to oracle");
    }

    if (
      currentBlockTimestamp > termEndTimestamp &&
      currentBlockTimestamp - termEndTimestamp < timeDelta
    ) {
      console.log(
        "current time is bigger than end time and delta is less than 1 hour"
      );

      if (latestOracleQueryTime >= termEndTimestamp.toString()) {
        hre.run("writeRateOracle", { rateOracle: rateOracleAddress });
        console.log("Successfully wrote to the oracle (end)");
      }
    } else {
      console.log("Did not write to oracle");
    }

    // Check if the latest rate oracle write was done > x (settable parameter) seconds in the past, if yes then write
    if (latestOracleQueryTime > timeDelta.toString()) {
      console.log("Calling variableFactor()");
      const rateOracle = await getRateOracleByNameOrAddress(
        hre,
        rateOracleAddress
      );
      const vf = rateOracle.variableFactor(
        termStartTimestamp * 1e16,
        termEndTimestamp * 1e16
      );
      console.log("printing vf: ", vf);
    } else {
      console.log("Did not call variable factor");
    }
  } // for loop brace
});

task(
  "transferRateOracleOwnership",
  "Transfers rate oracle ownership to the multisig address configured in hardhat.config.ts"
)
  .addParam(
    "rateOracle",
    "The address of a rate oracle, or the name of the rate oracle as defined in deployments/<network> (e.g. 'AaveRateOracle_USDT'"
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    );
    const { deployer, multisig } = await hre.getNamedAccounts();

    // console.log(`Listing Rates known by Rate Oracle ${rateOracle.address}`);

    const owner = await rateOracle.owner();

    if (owner === multisig) {
      console.log(`Already owned by ${multisig}. No need to transfer`);
    } else if (owner === deployer) {
      await rateOracle.transferOwnership(multisig);
      console.log(`Ownership transferred from ${owner} to ${multisig}`);
    } else {
      console.log(
        `Cannot transfer ownership of rate oracle ${rateOracle.address} using account ${deployer} because it is owned by ${owner}`
      );
    }
  });

module.exports = {};
