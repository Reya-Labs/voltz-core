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
  const marginEngineABI = [
    "function termStartTimestampWad() external view override returns (uint256)",
    "function termEndTimestampWad() external view override returns (uint256)",
    "function rateOracle() external view override returns(address)",
  ];

  const rateOracleABI = [
    "function settlementRateCache(uint32 termStartTimestamp, uint32 termEndTimestamp) external view returns(uint256)",
    "function minSecondsSinceLastUpdate() external view returns(uint256)",
    "function oracleVars() external view returns(uint16 rateIndex, uint16 rateCardinality, uint16 rateCardinalityNext)",
    "function observations(uint256 id) external view returns(uint32 blockTimestamp, uint216 observedValue, bool initialized)",
    "function writeOracleEntry() external",
    "function variableFactor(uint256 termStartTimestampInWeiSeconds, uint256 termEndTimestampInWeiSeconds) public returns(uint256 resultWad)",
  ];

  const factoryABI = [
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "contract IERC20Minimal",
          name: "underlyingToken",
          type: "address",
        },
        {
          indexed: true,
          internalType: "contract IRateOracle",
          name: "rateOracle",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "termStartTimestampWad",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "termEndTimestampWad",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "int24",
          name: "tickSpacing",
          type: "int24",
        },
        {
          indexed: false,
          internalType: "contract IMarginEngine",
          name: "marginEngine",
          type: "address",
        },
        {
          indexed: false,
          internalType: "contract IVAMM",
          name: "vamm",
          type: "address",
        },
        {
          indexed: false,
          internalType: "contract IFCM",
          name: "fcm",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint8",
          name: "yieldBearingProtocolID",
          type: "uint8",
        },
        {
          indexed: false,
          internalType: "uint8",
          name: "underlyingTokenDecimals",
          type: "uint8",
        },
      ],
      name: "IrsInstance",
      type: "event",
    },
  ];

  const factoryContract = new ethers.Contract(
    "0x6a7a5c3824508D03F0d2d24E0482Bea39E08CcAF",
    factoryABI,
    signer
  );

  const logs = await factoryContract.queryFilter(
    factoryContract.filters.IrsInstance()
  );
  const marginEngineAddresses = logs.map(
    (l) => factoryContract.interface.parseLog(l).args[5]
  );
  console.log(
    "Printing Margin Engine Addresses and how many ",
    marginEngineAddresses.length,
    marginEngineAddresses
  );

  // settable parameter for max. allowable time delta before a new write should happen (24 hours for now)
  const timeDelta = 86400;

  for (let i = 0; i < marginEngineAddresses.length; i++) {
    console.log(
      `Checking margin engine contract with address ${marginEngineAddresses[i]}`
    );
    const marginEngineContract = new ethers.Contract(
      marginEngineAddresses[i],
      marginEngineABI,
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
    console.log(
      "minSecondsSinceLastUpdate: ",
      minSecondsSinceLastUpdate.toNumber()
    );

    const settlementRateCache = await rateOracleContract.settlementRateCache(
      termStartTimestamp.div(BigInt(1e18)).toNumber(),
      termEndTimestamp.div(BigInt(1e18)).toNumber()
    );
    console.log("settlement cache rate: ", settlementRateCache.toNumber());

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

    if (
      currentBlockTimestamp > termEndTimestamp &&
      settlementRateCache.toNumber() === 0
    ) {
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
    speed: "safeLow",
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
