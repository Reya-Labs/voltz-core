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

async function main(
  signer: DefenderRelaySigner,
  provider: DefenderRelayProvider
) {
  const ABI = [
    "function termStartTimestampWad() external view override returns (uint256)",
    "function termEndTimestampWad() external view override returns (uint256)",
    "function rateOracle() external view override returns(address)",
  ];

  const rateOracleABI = [
    // not sure about the settlemtRateCache abi below, ask CR
    "function settlementRateCache(uint256 termStartTimestampInWeiSeconds, uint256 termEndTimestampInWeiSeconds) external view returns(uint256)",
    "function minSecondsSinceLastUpdate() external view returns(uint256)",
    "function oracleVars() external view returns(uint16 rateIndex, uint16 rateCardinality, uint16 rateCardinalityNext)",
    "function observations(uint256 id) external view returns(uint32 blockTimestamp, uint216 observedValue, bool initialized)",
    "function writeOracleEntry() external",
    "function variableFactor(uint256 termStartTimestampInWeiSeconds, uint256 termEndTimestampInWeiSeconds) public returns(uint256 resultWad)",
  ];

  const marginEngineAddresses = [
    "0x654316a63e68f1c0823f0518570bc108de377831", // aDAI
    "0x0bc09825ce9433b2cdf60891e1b50a300b069dd2", // aUSDC
    "0xf2ccd85a3428d7a560802b2dd99130be62556d30", // cDAI
    "0x21f9151d6e06f834751b614c2ff40fc28811b235", // stETH
    "0xb1125ba5878cf3a843be686c6c2486306f03e301", // rETH
    "0x33bA6A0B16750206195c777879Edd8706204154B", // aUSDC borrow
    "0x111A75E91625142E85193b67B10E53Acf82838cD", // cUSDT borrow
    "0x9b76B4d09229c339B049053F171BFB22cbE50092", // aave ETH borrow
  ];

  // settable parameter for max. allowable time delta before a new write should happen (24 hours for now)
  const timeDelta = 86400;

  for (let i = 0; i < marginEngineAddresses.length; i++) {
    console.log(
      `Checking margin engine contract with address ${marginEngineAddresses[i]}`
    );
    const marginEngineContract = new ethers.Contract(
      marginEngineAddresses[i],
      ABI,
      signer
    );

    const rateOracleAddress = await marginEngineContract.rateOracle();
    console.log("printing rate oracle address: ", rateOracleAddress);

    // get start time of margin engine i
    const termStartTimestamp =
      await await marginEngineContract.termStartTimestampWad();
    console.log(
      "start timestamp: ",
      termStartTimestamp.div(BigInt(1e18)).toNumber()
    );

    // get end time of margin engine i
    const termEndTimestamp =
      await await marginEngineContract.termEndTimestampWad();
    console.log(
      "end timestamp: ",
      termEndTimestamp.div(BigInt(1e18)).toNumber()
    );

    // get current block timestamp i.e. time now
    const currentBlockTimestamp = await (
      await provider.getBlock("latest")
    ).timestamp;
    console.log("current block timestamp:", currentBlockTimestamp);

    const rateOracleContract = new ethers.Contract(
      rateOracleAddress,
      rateOracleABI,
      signer
    );

    const oracleVars = await rateOracleContract.oracleVars();
    // get the latest observation
    console.log("oracle vars: ", oracleVars);
    const observation = await rateOracleContract.observations(
      oracleVars.rateIndex
    );
    console.log("oracle observation: ", observation);
    // get the latest observation timestamp
    const latestOracleQueryTime = observation.blockTimestamp;
    console.log("oracle last query time: ", latestOracleQueryTime);

    // get the min seconds since last rate update for this rate oracle
    const minSecondsSinceLastUpdate =
      await rateOracleContract.minSecondsSinceLastUpdate();

    if (
      latestOracleQueryTime < termStartTimestamp &&
      currentBlockTimestamp - latestOracleQueryTime > minSecondsSinceLastUpdate
    ) {
      const writeEntry = await rateOracleContract.writeOracleEntry({
        gasLimit: 10000000,
      });
      console.log("Successfully wrote to the oracle (start)");
      await writeEntry.wait();
    } else if (latestOracleQueryTime > timeDelta) {
      const writeEntry = await rateOracleContract.writeOracleEntry({
        gasLimit: 10000000,
      });
      console.log("Successfully wrote to the oracle (start)");
      await writeEntry.wait();
    } else {
      console.log("Rate oracle is up-to-date. Nice!");
    }

    const settlementRateCache = await rateOracleContract.settlementRateCache(
      termStartTimestamp,
      termEndTimestamp
    );

    if (currentBlockTimestamp > termEndTimestamp && settlementRateCache === 0) {
      const vfTx = await rateOracleContract.variableFactor(
        termStartTimestamp,
        termEndTimestamp
      );
      await vfTx.wait();
      console.log("Called Variable Factor");
    } else if (currentBlockTimestamp - termEndTimestamp > timeDelta) {
      const vfTx = await rateOracleContract.variableFactor(
        termStartTimestamp,
        termEndTimestamp
      );
      await vfTx.wait();
      console.log("Called Variable Factor");
    } else {
      console.log("Variable factor is up to date. Nice!");
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

// Typescript type definitions
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
