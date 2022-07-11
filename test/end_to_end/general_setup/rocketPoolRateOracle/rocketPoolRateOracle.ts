import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { RateOracleDataPoint } from "../../../../deployConfig/types";
import { BaseRateOracle, MockRocketEth } from "../../../../typechain";
import { advanceTimeAndBlock } from "../../../helpers/time";

const { provider } = waffle;

let shiftBlockNumber: number;
let shiftTimestamp: number;

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

it("lido rate oracle simulation:", async () => {
  const startingBlock = 14980000;
  const startingTimestamp = 1655480913;

  shiftBlockNumber = startingBlock - (await provider.getBlockNumber());
  shiftTimestamp =
    startingTimestamp -
    (await provider.getBlock(await provider.getBlockNumber())).timestamp;

  const trustedDataPoints: RateOracleDataPoint[] = [
    [1655679498, "1028327594600088450724742946"],
    [1655764768, "1028430127337714540873785202"],
    [1655855032, "1028537459816155530029681806"],
    [1655948265, "1028648713128345690215441392"],
    [1656133955, "1028870792044367037579410399"],
    [1656227854, "1028983791573806158062493864"],
    [1656320957, "1029096447561969681971221330"],
    [1656414600, "1029211414125755348808435812"],
    [1656507451, "1029316227654002773627484408"],
  ];

  const trustedTimestamps = [];
  const trustedRates = [];

  for (let i = 0; i < trustedDataPoints.length; i++) {
    trustedTimestamps.push(trustedDataPoints[i][0] - shiftTimestamp);
    trustedRates.push(trustedDataPoints[i][1]);
  }

  {
    const currentBlockNumber = await provider.getBlockNumber();
    const currentBlock = await provider.getBlock(currentBlockNumber);
    const currentTimestamp = currentBlock.timestamp;

    const deploymentBlockNumber = 15052947 - shiftBlockNumber;
    const deploymentBlockTimestamp = 1656629381 - shiftTimestamp;

    await advanceTimeAndBlock(
      BigNumber.from(
        deploymentBlockTimestamp -
          currentTimestamp -
          (deploymentBlockNumber - currentBlockNumber)
      ),
      deploymentBlockNumber - currentBlockNumber
    );
  }

  const mockRocketEthFactory = await ethers.getContractFactory("MockRocketEth");
  const mockRocketEth = (await mockRocketEthFactory.deploy()) as MockRocketEth;
  await mockRocketEth.setInstantUpdates(false);
  await mockRocketEth.setLastUpdatedBlockManipulation(true);
  await mockRocketEth.setRethMultiplierInRay("1029429559372708185506969368");
  await mockRocketEth.setLastUpdatedBlock(15050880 - shiftBlockNumber);

  const mockRocketNetworkBalancesFactory = await ethers.getContractFactory(
    "MockRocketNetworkBalances"
  );
  const mockRocketNetworkBalances =
    await mockRocketNetworkBalancesFactory.deploy(mockRocketEth.address);

  const mockWETHFactory = await ethers.getContractFactory("MockWETH");
  const mockWETH = await mockWETHFactory.deploy("Voltz WETH", "VWETH");

  const rateOracleFactory = await ethers.getContractFactory(
    "RocketPoolRateOracle"
  );
  const rateOracle = (await rateOracleFactory.deploy(
    mockRocketEth.address,
    mockRocketNetworkBalances.address,
    mockWETH.address,
    trustedTimestamps,
    trustedRates
  )) as BaseRateOracle;

  await rateOracle.setMinSecondsSinceLastUpdate(18 * 60 * 60);
  await rateOracle.increaseObservationCardinalityNext(100);

  {
    const currentBlockNumber = await provider.getBlockNumber();
    const currentBlock = await provider.getBlock(currentBlockNumber);
    const currentTimestamp = currentBlock.timestamp;

    const nextBlockNumber = 15056640 - shiftBlockNumber;
    const nextTimestamp = 1656678850 - shiftTimestamp;

    await advanceTimeAndBlock(
      BigNumber.from(
        nextTimestamp -
          currentTimestamp -
          (nextBlockNumber - currentBlockNumber)
      ),
      nextBlockNumber - currentBlockNumber
    );
  }

  await mockRocketEth.setRethMultiplierInRay("1029523618065120550016203495");
  await mockRocketEth.setLastUpdatedBlock(15056640 - shiftBlockNumber);

  // eslint-disable-next-line no-unused-vars
  const timePerBlock = 13.7;

  const nextRates: [number, string][] = [
    [15062400 - shiftBlockNumber, "1029615611848183521206285083"],
    [15068160 - shiftBlockNumber, "1029709863690817326373202110"],
    [15079680 - shiftBlockNumber, "1029897352999515642818458091"],
    [15085440 - shiftBlockNumber, "1029992439594182747955859853"],
    [15091200 - shiftBlockNumber, "1030082929186402994490724061"],
    [15096960 - shiftBlockNumber, "1030176558094566769975853933"],
  ];
  let next = 0;

  for (let i = 25; i <= 45001; i += 25) {
    await advanceTimeAndBlock(
      BigNumber.from(Math.floor(25 * (timePerBlock - 1))),
      25
    );

    if (
      next < nextRates.length &&
      (await provider.getBlockNumber()) >= nextRates[next][0]
    ) {
      await mockRocketEth.setRethMultiplierInRay(nextRates[next][1]);
      await mockRocketEth.setLastUpdatedBlock(nextRates[next][0]);
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

  const blocks: number[] = [];
  const timestamps: number[] = [];
  const apys: number[] = [];

  const file = `historicalData/rateOracleApy/${rateOracle.address}.csv`;

  const header = "block,timestamp,apy";

  fs.appendFileSync(file, header + "\n");
  console.log(header);

  for (
    let b = 15056640 - shiftBlockNumber;
    b <= 15102460 - shiftBlockNumber;
    b += 175
  ) {
    const block = await provider.getBlock(b);

    try {
      const apy = await rateOracle.getApyFromTo(
        block.timestamp - 86400,
        block.timestamp,
        {
          blockTag: b,
        }
      );
      blocks.push(b + shiftBlockNumber);
      timestamps.push(block.timestamp + shiftTimestamp);
      apys.push(apy.div(BigNumber.from(10).pow(9)).toNumber() / 1e9);

      const lastBlock = blocks[blocks.length - 1];
      const lastTimestamp = timestamps[timestamps.length - 1];
      const lastApy = apys[apys.length - 1];

      fs.appendFileSync(file, `${lastBlock},${lastTimestamp},${lastApy}\n`);
      console.log(
        `${lastBlock},${lastTimestamp},${new Date(
          lastTimestamp * 1000
        ).toISOString()},${lastApy}`
      );
    } catch (e) {
      console.log("Couldn't fetch");
    }
  }
});
