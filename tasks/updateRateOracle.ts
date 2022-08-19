import { ethers } from "ethers";
import {
  DefenderRelaySigner,
  DefenderRelayProvider,
} from "defender-relay-client/lib/ethers";
import {
  RelayerParams,
  Relayer,
  RelayerModel,
} from "defender-relay-client/lib/relayer";

const ABI = [
  "function termStartTimestampWad() external view override returns (uint256)",
  "function termEndTimestampWad() external view override returns (uint256)",
  "function rateOracle() external view override returns(IRateOracle)",
];

const marginEngineAddresses = [
  "0x654316a63e68f1c0823f0518570bc108de377831", // aDAI
  "0x0bc09825ce9433b2cdf60891e1b50a300b069dd2", // aUSDC
  "0xf2ccd85a3428d7a560802b2dd99130be62556d30", // cDAI
  "0x21f9151d6e06f834751b614c2ff40fc28811b235", // stETH
  "0xb1125ba5878cf3a843be686c6c2486306f03e301", // rETH
];

// settable parameter for max. allowable time delta before a new write should happen (1 hour for now)
const timeDelta = 3600;

async function main(
  signer: DefenderRelaySigner,
  provider: DefenderRelayProvider
) {
  for (let i = 0; i < marginEngineAddresses.length; i++) {
    console.log(
      `Checking margin engine contract for ${marginEngineAddresses[i]}`
    );
    const marginEngineContract = new ethers.Contract(
      marginEngineAddresses[i],
      ABI,
      signer
    );
    const rateOracleAddress = await marginEngineContract.rateOracle();

    // sanity check console logs
    console.log(marginEngineAddresses[i]);
    console.log(
      "rate oracle derived from: ",
      await marginEngineContract.rateOracle()
    );

    // get start time of margin engine i
    const termStartTimestamp = await (
      await marginEngineContract.termStartTimestampWad()
    )
      .div(BigInt(1e18))
      .toNumber();
    console.log("start timestamp: ", termStartTimestamp);

    // get end time of margin engine i
    const termEndTimestamp = await (
      await marginEngineContract.termEndTimestampWad()
    )
      .div(BigInt(1e18))
      .toNumber();
    console.log("end timestamp: ", termEndTimestamp);

    // get current block timestamp i.e. time now
    const currentBlockTimestamp = await (
      await provider.getBlock("latest")
    ).timestamp;

    const rateOracleABI = [
      // not sure about this ABI --> needs review
      "function writeOracleEntry() external override(IRateOracle)",
      "function variableFactor(uint256 termStartTimestampInWeiSeconds, uint256 termEndTimestampInWeiSeconds) public override(IRateOracle) returns(uint256 resultWad)",
      // need to write the oracleVars abi here as well
    ];

    const rateOracleContract = new ethers.Contract(
      rateOracleAddress,
      rateOracleABI,
      signer
    );

    const oracleVars = await rateOracleContract.oracleVars();
    // get the latest observation
    const observation = await rateOracleContract.observations(
      oracleVars.rateIndex.length - 1
    );
    // get the latest observation timestamp
    const latestOracleQueryTime = `\n${observation.blockTimestamp}`;

    if (
      currentBlockTimestamp > termStartTimestamp &&
      currentBlockTimestamp - termStartTimestamp < timeDelta
    ) {
      console.log(
        "Current time is bigger than start time and delta is less than 1 hour"
      );

      if (latestOracleQueryTime >= termStartTimestamp) {
        const writeEntry = await rateOracleContract.writeOracleEntry({
          gasLimit: 10000000,
        });
        console.log("Successfully wrote to the oracle (start)");
        return writeEntry;
      }
    } else {
      console.log(
        "Did not write to oracle --> start timestamp is bigger than last oracle entry"
      );
    }

    if (
      currentBlockTimestamp > termEndTimestamp &&
      currentBlockTimestamp - termEndTimestamp < timeDelta
    ) {
      console.log(
        "current time is bigger than end time and delta is less than 1 hour"
      );

      if (latestOracleQueryTime >= termEndTimestamp) {
        const writeEntryTx = await rateOracleContract.writeOracleEntry({
          gasLimit: 10000000,
        });
        console.log("Successfully wrote to the oracle (start)");
        await writeEntryTx.wait();
      }
    } else {
      console.log("Did not write to oracle");
    }

    // Check if the latest rate oracle write was done > x (settable parameter) seconds in the past, if yes then write
    if (latestOracleQueryTime > timeDelta.toString()) {
      const vfTx = rateOracleContract.variableFactor(
        termStartTimestamp * 1e16,
        termEndTimestamp * 1e16
      );
      await vfTx.wait();
    } else {
      console.log("Did not call variable factor");
    }
  } // for loop brace
} // async function main ending brace

// Entrypoint for the Autotask
export async function handler(credentials: RelayerParams) {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  const relayer = new Relayer(credentials);
  const info: RelayerModel = await relayer.getRelayer();
  console.log(`Relayer address is ${info.address}`);

  await main(signer, provider);
}

// Exported for running locally
exports.main = main;

// Sample typescript type definitions
type EnvInfo = {
  RELAY_API_KEY: string;
  RELAY_API_SECRET: string;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require("dotenv").config();
  const { RELAY_API_KEY: apiKey, RELAY_API_SECRET: apiSecret } =
    process.env as EnvInfo;
  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });
}
