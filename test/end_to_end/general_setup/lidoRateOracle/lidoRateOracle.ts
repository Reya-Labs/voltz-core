import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { RateOracleDataPoint } from "../../../../deployConfig/types";
import {
  BaseRateOracle,
  MockLidoOracle,
  MockStEth,
} from "../../../../typechain";
import { advanceTimeAndBlock } from "../../../helpers/time";

const { provider } = waffle;

let shiftBlockNumber: number;
let shiftTimestamp: number;

const getCurrentTimestamp = async () => {
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);

  return block.timestamp;
};

// eslint-disable-next-line no-unused-vars
const writeCurrentMoment = async () => {
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  console.log(
    `bn: ${blockNumber + shiftBlockNumber}, tmp: ${
      block.timestamp + shiftTimestamp
    }`
  );
};

// returns the earliest block such as block.timestamp > timestamp
const getBlockAtTimestamp = async (timestamp: number) => {
  let lo = 0;
  let hi = await provider.getBlockNumber();
  let result = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);

    const midBlock = await provider.getBlock(mid);
    if (midBlock.timestamp > timestamp) {
      result = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return result;
};

it.skip("lido rate oracle simulation:", async () => {
  const startingBlock = 14980000;
  const startingTimestamp = 1655480913;

  shiftBlockNumber = startingBlock - (await provider.getBlockNumber());
  shiftTimestamp = startingTimestamp - (await getCurrentTimestamp());

  const trustedDataPoints: RateOracleDataPoint[] = [
    [1655812823, "1075753005957224757634508350"],
    [1655899223, "1075870157728924987622204368"],
    [1655985623, "1075986987249309892706409445"],
    [1656072023, "1076104367462616827049814244"],
    [1656158423, "1076221273888978950003372815"],
    [1656244823, "1076338244388204416534613903"],
    [1656331223, "1076454877601569321869671702"],
    [1656417623, "1076571805980165022361453919"],
    [1656504023, "1076688660297006942565885179"],
  ];

  const trustedTimestamps = [];
  const trustedRates = [];

  for (let i = 0; i < trustedDataPoints.length; i++) {
    trustedTimestamps.push(trustedDataPoints[i][0] - shiftTimestamp);
    trustedRates.push(trustedDataPoints[i][1]);
  }

  // advance to hit contract deployment
  {
    const currentTimestamp = await getCurrentTimestamp();

    const deploymentBlockTimestamp = 1656676445 - shiftTimestamp;

    await advanceTimeAndBlock(
      BigNumber.from(deploymentBlockTimestamp - currentTimestamp),
      1
    );
  }

  const mockStEthFactory = await ethers.getContractFactory("MockStEth");
  const mockStEth = (await mockStEthFactory.deploy()) as MockStEth;
  await mockStEth.setInstantUpdates(false);
  await mockStEth.setLastUpdatedTimestampManipulation(true);
  await mockStEth.setSharesMultiplierInRay("1076805850648432598627798531");
  await mockStEth.setLastUpdatedTimestamp(1656590423 - shiftTimestamp);

  const mockLidoOracleFactory = await ethers.getContractFactory(
    "MockLidoOracle"
  );
  const mockLidoOracle = (await mockLidoOracleFactory.deploy(
    mockStEth.address
  )) as MockLidoOracle;

  const mockWETHFactory = await ethers.getContractFactory("MockWETH");
  const mockWETH = await mockWETHFactory.deploy("Voltz WETH", "VWETH");

  const rateOracleFactory = await ethers.getContractFactory("LidoRateOracle");
  const rateOracle = (await rateOracleFactory.deploy(
    mockStEth.address,
    mockLidoOracle.address,
    mockWETH.address,
    trustedTimestamps,
    trustedRates
  )) as BaseRateOracle;

  await rateOracle.setMinSecondsSinceLastUpdate(18 * 60 * 60);
  await rateOracle.increaseObservationCardinalityNext(100);

  // advance to hit the next rate update
  {
    const currentTimestamp = await getCurrentTimestamp();

    const nextTimestamp = 1656676823 - shiftTimestamp;

    await advanceTimeAndBlock(
      BigNumber.from(nextTimestamp - currentTimestamp),
      1
    );
  }

  await mockStEth.setSharesMultiplierInRay("1076922239357196746188616412");
  await mockStEth.setLastUpdatedTimestamp(1656676823 - shiftTimestamp);

  const nextRates = [
    [1656763223 - shiftTimestamp, "1077039569267086687687246006"],
    [1656849623 - shiftTimestamp, "1077155719316616284685218763"],
    [1656936023 - shiftTimestamp, "1077272225887644039895119928"],
    [1657022423 - shiftTimestamp, "1077389108821174620494509541"],
    [1657108823 - shiftTimestamp, "1077505539378612583110510837"],
    [1657195223 - shiftTimestamp, "1077623031079333642872916619"],
    [1657281623 - shiftTimestamp, "1077740031078281916028545936"],
    [1657368023 - shiftTimestamp, "1077857005650125989376619116"],
  ];
  let next = 0;

  const lastTimestamp = 1657510615;
  for (
    let i = await getCurrentTimestamp();
    i <= 1657510615 - shiftTimestamp;
    i += 375
  ) {
    await advanceTimeAndBlock(BigNumber.from(375), 1);

    const blockTimestamp = await getCurrentTimestamp();

    if (next < nextRates.length && blockTimestamp >= nextRates[next][0]) {
      await mockStEth.setSharesMultiplierInRay(nextRates[next][1]);
      await mockStEth.setLastUpdatedTimestamp(nextRates[next][0]);

      next += 1;
    }

    await rateOracle.writeOracleEntry();
  }

  const rateIndex = (await rateOracle.oracleVars()).rateIndex;

  const fs = require("fs");
  const file_rni = `historicalData/rateOracleRates/${rateOracle.address}.csv`;

  fs.appendFileSync(file_rni, "timestamp,rate\n");

  for (let i = 0; i <= rateIndex; i++) {
    const [rateTimestamp, rateValue] = await rateOracle.observations(i);

    fs.appendFileSync(
      file_rni,
      `${(rateTimestamp + shiftTimestamp).toString()},${rateValue}\n`
    );
  }

  const timestamps: number[] = [];
  const apys: number[] = [];

  const file = `historicalData/rateOracleApy/${rateOracle.address}.csv`;

  const header = "timestamp,apy";

  fs.appendFileSync(file, header + "\n");
  console.log(header);

  const lookback_window = 100800;

  const apyStartingTimestamp =
    (await rateOracle.observations(0)).blockTimestamp + lookback_window;

  for (
    let tmp = apyStartingTimestamp;
    tmp <= lastTimestamp - shiftTimestamp;
    tmp += 1000
  ) {
    const timestampBlock = await getBlockAtTimestamp(tmp);

    try {
      const apy = await rateOracle.getApyFromTo(tmp - lookback_window, tmp, {
        blockTag: timestampBlock,
      });
      timestamps.push(tmp + shiftTimestamp);
      apys.push(apy.div(BigNumber.from(10).pow(9)).toNumber() / 1e9);

      const lastTimestamp = timestamps[timestamps.length - 1];
      const lastApy = apys[apys.length - 1];

      fs.appendFileSync(file, `${lastTimestamp},${lastApy}\n`);
      console.log(
        `$${lastTimestamp},${new Date(
          lastTimestamp * 1000
        ).toISOString()},${lastApy}`
      );
    } catch (e) {
      console.log("Couldn't fetch");
    }
  }
});
