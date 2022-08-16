import * as dotenv from "dotenv";
import type {
  ContractsConfig,
  ContractsConfigMap,
  IrsConfigDefaults,
  RateOracleConfigDefaults,
  RateOracleDataPoint,
} from "./types";
// import { network } from "hardhat"; // Not importable from tasks
import { toBn } from "../test/helpers/toBn";
import { BaseRateOracle } from "../typechain";
import { BigNumberish } from "ethers";

dotenv.config();

const MAX_BUFFER_GROWTH_PER_TRANSACTION = 100;
const BUFFER_SIZE_SAFETY_FACTOR = 1.2; // The buffer must last for 1.2x as long as the longest expected IRS

function duplicateExists(arr: string[]) {
  return new Set(arr).size !== arr.length;
}

const marginCalculatorDefaults1 = {
  apyUpperMultiplierWad: toBn(1.5),
  apyLowerMultiplierWad: toBn(0.7),
  sigmaSquaredWad: toBn(0.5),
  alphaWad: toBn(0.1),
  betaWad: toBn(1),
  xiUpperWad: toBn(2),
  xiLowerWad: toBn(1.5),
  tMaxWad: toBn(31536000), // one year
  devMulLeftUnwindLMWad: toBn(0.5),
  devMulRightUnwindLMWad: toBn(0.5),
  devMulLeftUnwindIMWad: toBn(1.5),
  devMulRightUnwindIMWad: toBn(1.5),
  fixedRateDeviationMinLeftUnwindLMWad: toBn(5),
  fixedRateDeviationMinRightUnwindLMWad: toBn(5),
  fixedRateDeviationMinLeftUnwindIMWad: toBn(10),
  fixedRateDeviationMinRightUnwindIMWad: toBn(10),
  gammaWad: toBn(1),
  minMarginToIncentiviseLiquidators: 0,
};

// same for rinkeby
const kovanIrsConfigDefaults: IrsConfigDefaults = {
  marginEngineLookbackWindowInSeconds: 60 * 60 * 6, // 6 hours
  // marginEngineLookbackWindowInSeconds: 1209600, // 2 weeks
  marginEngineCacheMaxAgeInSeconds: 6 * 60 * 60, // 6 hours
  marginEngineLiquidatorRewardWad: toBn(0.1),
  marginEngineCalculatorParameters: marginCalculatorDefaults1,
  vammFeeProtocol: 10,
  vammFeeWad: toBn(0.009), // 0.9%, for 30 day pool
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough,
  lpMarginCap: {
    eth: 1300,
    stableCoin: 1500000,
  },
};
const kovanRateOracleConfigDefaults: RateOracleConfigDefaults = {
  rateOracleBufferSize: 200, // For mock token oracle
  rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60, // FOr mock token oracle. 6 hours
  trustedDataPoints: [],
};

// TODO: update these and make them settable *per-duration-per-token*? That's a lot of data so maybe better just to have IRS creation script read it from file.
const mainnetIrsConfigDefaults: IrsConfigDefaults = {
  marginEngineLookbackWindowInSeconds: 60 * 60 * 24 * 25, // 25 days
  // marginEngineLookbackWindowInSeconds: 1209600, // 2 weeks
  marginEngineCacheMaxAgeInSeconds: 6 * 60 * 60, // 6 hours
  marginEngineLiquidatorRewardWad: toBn(0.05), // 5%
  marginEngineCalculatorParameters: marginCalculatorDefaults1,
  vammFeeProtocol: 0,
  vammFeeWad: toBn(0.003), // 0.3%, for 30 day pool
  maxIrsDurationInSeconds: 60 * 60 * 24 * 92, // 92 days. Do not increase without checking that rate oracle buffers are large enough
  lpMarginCap: {
    eth: 1300,
    stableCoin: 1500000,
  },
};

const mainnetRateOracleConfigDefaults: RateOracleConfigDefaults = {
  rateOracleBufferSize: 500, // Used for Mocks, and for platforms with no token config
  rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60, // Used for Mocks, and for platforms with no token config
  trustedDataPoints: [],
};

const localhostIrsConfigDefaults = {
  ...kovanIrsConfigDefaults,
  marginEngineLookbackWindowInSeconds: 60 * 60, // 1 hour
  marginEngineCacheMaxAgeInSeconds: 60 * 60, // 1 hour
  rateOracleMinSecondsSinceLastUpdate: 60 * 60, // 1 hour
  rateOracleBufferSize: 1000,
  maxIrsDurationInSeconds: 60 * 60 * 24 * 90, // 30 days. Do not increase without checking that rate oracle buffers are large enough
};
const localhostRateOracleConfigDefaults = {
  ...kovanRateOracleConfigDefaults,
  rateOracleMinSecondsSinceLastUpdate: 60 * 60, // 1 hour
  rateOracleBufferSize: 1000,
};

const mainnetStEthDataPoints: RateOracleDataPoint[] = [
  [1656590423, "1076805850648432598627799331"],
  [1656676823, "1076922239357196746188602894"],
  [1656763223, "1077039569267086687687246028"],
  [1656849623, "1077155719316616284685218379"],
  [1656936023, "1077272225887644039895134408"],
  [1657022423, "1077389108821174620494509149"],
  [1657108823, "1077505539378612583110509059"],
  [1657195223, "1077623031079333642872923949"],
  [1657281623, "1077740031078281916028542531"],
  [1657368023, "1077857005650125989376615298"],
];

// Populate these fields just before you deploy to mainnet so you get the most recent data.
// const mainnetAaveBorrowUSDCPoints: RateOracleDataPoint[] = [];

// const mainnetAaveBorrowDaiPoints: RateOracleDataPoint[] = [];

const mainnetRocketEthDataPoints: RateOracleDataPoint[] = [
  [1654153801, "1026502356712851858611688825"],
  // [1654234515, "1026599253986324262373044488"],
  // [1654314941, "1026694705754126078365590449"],
  [1654400221, "1026793795816522881011714495"],
  // [1654484710, "1026892161919818755759184649"],
  // [1654569774, "1026994899740333412633025897"],
  [1654653662, "1027094919285384123607191853"],
  // [1654738098, "1027197987462039863431813806"],
  // [1654823350, "1027304108017384923832661768"],
  [1654908339, "1027407532010818332514656018"],
  // [1654992930, "1027506135897336606399828613"],
  // [1655078280, "1027610544918212630548787268"],
  [1655163630, "1027711269610859760832754547"],
  // [1655250122, "1027815867812309024715116363"],
  // [1655336680, "1027916443504608293076967304"],
  [1655422235, "1028020261352758203022591045"],
  // [1655507222, "1028123706255948268702655006"],
  // [1655592723, "1028225193334701894377733481"],
  [1655679498, "1028327594600088450724742946"],
  // [1655764768, "1028430127337714540873785202"],
  // [1655855032, "1028537459816155530029681806"],
  [1655948265, "1028648713128345690215441392"],
  // [1656041679, "1028759852902103566947339476"],
  // [1656133955, "1028870792044367037579410399"],
  [1656227854, "1028983791573806158062493864"],
  // [1656320957, "1029096447561969681971221330"],
  // [1656414600, "1029211414125755348808435812"],
  [1656507451, "1029316227654002773627484408"],
  // [1656600130, "1029429559372708185506969368"],
  [1656678850, "1029523618065120550016203495"],
  // [1656755579, "1029615611848183521206285083"],
  // [1656832806, "1029709863690817326373202110"],
  [1656909442, "1029803630340691797390055876"],
  // [1656986291, "1029897352999515642818458091"],
  // [1657063181, "1029992439594182747955859853"],
  [1657140236, "1030082929186402994490724061"],
  // [1657217451, "1030176558094566769975853933"],
  // [1657294050, "1030270326311081920642213869"],
  [1657371441, "1030363035676219783347593823"],
  // [1657446756, "1030451682866003654130160522"],
  // [1657524366, "1030544421977352794532622788"],
  [1657600825, "1030629617919391988360741953"],
  // [1657677598, "1030720943236031468092101351"],
];

const goerliStEthDataPoints: RateOracleDataPoint[] = [
  [1654485600, "1008924600350995571702479730"],
  [1656275040, "1009005858244768527585507145"],
];

const goerliRocketEthDataPoints: RateOracleDataPoint[] = [
  [1657435372, "1026780389412413279149346221"],
];

const borrowAaveUSDCMainnetTrustedDatapoints: RateOracleDataPoint[] = [
  [1658618955, "1109755147923344578270859036"],
  [1658705395, "1109800811525858567378907794"],
  [1658791844, "1109847380780342472867486463"],
  [1658878278, "1109894818250135099335640168"],
  [1658964143, "1109942844266595658870197351"],
  [1659050336, "1109992073317241503323476791"],
  [1659136611, "1110041901548415395110548722"],
  [1659222426, "1110094318598328195275099717"],
  [1659308455, "1110146531886525921197028893"],
  [1659394598, "1110198650640220951402529044"],
];

// const borrowAaveDAIMainnetTrustedDatapoints: RateOracleDataPoint[] = [
//   [1658618955, "1117966593199281135728219837"],
//   [1658705395, "1118018695182045164396692532"],
//   [1658791844, "1118071106638648460872409173"],
//   [1658878278, "1118124757765554251803617763"],
//   [1658964143, "1118178147638664683631209841"],
//   [1659050336, "1118231868303527545230359866"],
//   [1659136611, "1118286000420413818106075678"],
//   [1659222426, "1118339792850033479958022476"],
//   [1659308455, "1118393412519376952322372670"],
//   [1659394598, "1118446903846278865566379088"],
// ];

const rinkebyConfig = {
  irsConfig: kovanIrsConfigDefaults,
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cUSDC",
        address: "0x5b281a6dda0b271e91ae35de655ad301c976edb1",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
    defaults: kovanRateOracleConfigDefaults,
  },
};

const goerliConfig = {
  irsConfig: kovanIrsConfigDefaults,
  weth: "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cETH",
        address: "0x20572e4c090f15667cf7378e16fad2ea0e2f3eff",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "cDAI",
        address: "0x822397d9a55d0fefd20f5c4bcab33c5f65bd28eb",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "cUSDC",
        address: "0xcec4a43ebb02f9b80916f1c718338169d6d5c1f0",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
    defaults: kovanRateOracleConfigDefaults,
  },
  lidoConfig: {
    lidoStETH: "0x1643E812aE58766192Cf7D2Cf9567dF2C37e9B7F",
    lidoOracle: "0x24d8451BC07e7aF4Ba94F69aCDD9ad3c6579D9FB",
    defaults: {
      rateOracleBufferSize: 300,
      trustedDataPoints: goerliStEthDataPoints,
      rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60, // Lido rates only get updated once a day
    },
  },
  rocketPoolConfig: {
    rocketPoolRocketToken: "0x178e141a0e3b34152f73ff610437a7bf9b83267a",
    rocketNetworkBalances: "0x28cea7b0f3916c1dba667d3d58ec4836ad843c49",
    defaults: {
      rateOracleBufferSize: 300,
      trustedDataPoints: goerliRocketEthDataPoints,
      rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60,
    },
  },
};

const kovanConfig = {
  irsConfig: kovanIrsConfigDefaults,
  weth: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
  aaveConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    defaults: kovanRateOracleConfigDefaults,
    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      // {
      //   name: "USDT",
      //   address: "0x13512979ADE267AB5100878E2e0f485B568328a4",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      {
        name: "USDC",
        address: "0xe22da380ee6B445bb8273C81944ADEB6E8450422",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "TUSD",
        address: "0x016750ac630f711882812f24dba6c95b9d35856d",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
        trustedDataPoints: [],
      },
      {
        name: "WETH",
        address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      // {
      //   name: "UNI",
      //   address: "0x075A36BA8846C6B6F53644fDd3bf17E5151789DC",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "BAT",
      //   address: "0x2d12186fbb9f9a8c28b3ffdd4c42920f8539d738",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "BUSD",
      //   address: "0x4c6E1EFC12FDfD568186b7BAEc0A43fFfb4bCcCf",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "REN",
      //   address: "0x5eebf65a6746eed38042353ba84c8e37ed58ac6f",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
      // {
      //   name: "MRK",
      //   address: "0x61e4CAE3DA7FD189e52a4879C7B8067D7C2Cc0FA",
      //   rateOracleBufferSize: 200,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      // },
    ],
  },
  aaveBorrowConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    defaults: kovanRateOracleConfigDefaults,
    // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
    // See tokens list at https://aave.github.io/aave-addresses/kovan.json
    // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
    aaveTokens: [
      {
        name: "USDC",
        address: "0xe22da380ee6B445bb8273C81944ADEB6E8450422",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "TUSD",
        address: "0x016750ac630f711882812f24dba6c95b9d35856d",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
        trustedDataPoints: [],
      },
      {
        name: "WETH",
        address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
        rateOracleBufferSize: 200,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
  compoundConfig: {
    // See tokens list at https://compound.finance/docs#networks
    compoundTokens: [
      {
        name: "cUSDC",
        address: "0x4a92e71227d294f041bd82dd8f78591b75140d63",
        rateOracleBufferSize: 300,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
    defaults: kovanRateOracleConfigDefaults,
  },
};

const mainnetConfig: ContractsConfig = {
  irsConfig: mainnetIrsConfigDefaults,
  weth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  aaveConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
    defaults: mainnetRateOracleConfigDefaults,
    aaveTokens: [
      {
        name: "USDC",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        rateOracleBufferSize: 500,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
      {
        name: "DAI",
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        rateOracleBufferSize: 500,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
  aaveBorrowConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
    defaults: mainnetRateOracleConfigDefaults,
    aaveTokens: [
      {
        name: "USDC",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        rateOracleBufferSize: 500,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
        trustedDataPoints: borrowAaveUSDCMainnetTrustedDatapoints,
      },
      // {
      //   name: "DAI",
      //   address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      //   rateOracleBufferSize: 500,
      //   minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      //   trustedDataPoints: borrowAaveDAIMainnetTrustedDatapoints,
      // },
    ],
  },
  compoundConfig: {
    defaults: mainnetRateOracleConfigDefaults,
    compoundTokens: [
      {
        name: "cDAI",
        address: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
        rateOracleBufferSize: 500,
        minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
      },
    ],
  },
  lidoConfig: {
    // Lido deployment info at https://github.com/lidofinance/lido-dao/tree/816bf1d0995ba5cfdfc264de4acda34a7fe93eba#mainnet
    lidoStETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    lidoOracle: "0x442af784A788A5bd6F42A01Ebe9F287a871243fb",
    defaults: {
      rateOracleBufferSize: 500,
      trustedDataPoints: mainnetStEthDataPoints,
      rateOracleMinSecondsSinceLastUpdate: 18 * 60 * 60, // Lido rates only get updated once a day
    },
  },
  rocketPoolConfig: {
    // RocketPool deployment info at ???
    rocketPoolRocketToken: "0xae78736cd615f374d3085123a210448e74fc6393",
    rocketNetworkBalances: "0x138313f102ce9a0662f826fca977e3ab4d6e5539",
    defaults: {
      rateOracleBufferSize: 500,
      trustedDataPoints: mainnetRocketEthDataPoints,
      rateOracleMinSecondsSinceLastUpdate: 18 * 60 * 60, // Lido rates only get updated once a day
    },
  },
  skipFactoryDeploy: true, // On mainnet we use a community deployer
  factoryOwnedByMultisig: true, // On mainnet, transactions to the factory must go through a multisig

  // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
  // See tokens list at https://aave.github.io/aave-addresses/kovan.json
  // See tokens list at https://compound.finance/docs#networks
};

const localhostConfig: ContractsConfig = {
  irsConfig: localhostIrsConfigDefaults,
  aaveConfig: {
    aaveTokens: [],
    defaults: localhostRateOracleConfigDefaults,
  },
  aaveBorrowConfig: {
    aaveTokens: [],
    defaults: localhostRateOracleConfigDefaults,
  },
  compoundConfig: {
    compoundTokens: [],
    defaults: localhostRateOracleConfigDefaults,
  },
};

const config: ContractsConfigMap = {
  kovan: kovanConfig,
  goerli: goerliConfig,
  rinkeby: rinkebyConfig,
  // localhost: mainnetConfig, // Uncomment if testing against a fork of an existing mainnet system
  localhost: localhostConfig,
  mainnet: mainnetConfig,
  // hardhat: kovanConfig, // uncomment if testing against a kovan fork
  // hardhat: { ...mainnetConfig, skipFactoryDeploy: false, }, // uncomment if deploying a new system against a mainnet fork
  hardhat: process.env.FORK_MAINNET
    ? { ...mainnetConfig, skipFactoryDeploy: false }
    : process.env.FORK_KOVAN
    ? kovanConfig
    : localhostConfig,
};

export const getConfig = (_networkName: string): ContractsConfig => {
  if (!config[_networkName]) {
    throw Error(`No deploy config found for network ${_networkName}`);
  }

  const _config = config[_networkName];
  if (
    _config.compoundConfig?.compoundTokens &&
    duplicateExists(_config.compoundConfig?.compoundTokens?.map((t) => t.name))
  ) {
    throw Error(
      `Duplicate token names configured for Compound on network ${_networkName}`
    );
  }

  if (
    _config.aaveConfig?.aaveTokens &&
    duplicateExists(_config.aaveConfig?.aaveTokens?.map((t) => t.name))
  ) {
    throw Error(
      `Duplicate token names configured for Aave on network ${_networkName}`
    );
  }

  return config[_networkName];
};

interface TrustedDataPoints {
  trustedTimestamps: number[];
  trustedObservationValuesInRay: BigNumberish[];
}

export const convertTrustedRateOracleDataPoints = (
  trustedDataPoints: RateOracleDataPoint[]
): TrustedDataPoints => {
  let trustedTimestamps: number[] = [];
  let trustedObservationValuesInRay: BigNumberish[] = [];
  if (trustedDataPoints?.length > 0) {
    trustedTimestamps = trustedDataPoints.map((e) => e[0]);
    trustedObservationValuesInRay = trustedDataPoints.map((e) => e[1]);
  }
  return { trustedTimestamps, trustedObservationValuesInRay };
};

export const applyBufferConfig = async (
  r: BaseRateOracle,
  minBufferSize: number,
  minSecondsSinceLastUpdate: number,
  maxIrsDurationInSeconds: number
) => {
  const secondsWorthOfBuffer = minBufferSize * minSecondsSinceLastUpdate;
  if (
    secondsWorthOfBuffer <
    maxIrsDurationInSeconds * BUFFER_SIZE_SAFETY_FACTOR
  ) {
    throw new Error(
      `Buffer config of {size ${minBufferSize}, minGap ${minSecondsSinceLastUpdate}s} ` +
        `does not guarantee adequate buffer for an IRS of duration ${maxIrsDurationInSeconds}s`
    );
  }

  let currentSize = (await r.oracleVars())[2];
  // console.log(`currentSize of ${r.address} is ${currentSize}`);

  const bufferWasTooSmall = currentSize < minBufferSize;
  if (bufferWasTooSmall) {
    process.stdout.write(
      `Increasing size of ${r.address}'s buffer to ${minBufferSize}.`
    );
  }

  while (currentSize < minBufferSize) {
    // Growing the buffer can use a lot of gas so we may split buffer growth into multiple trx
    const newSize = Math.min(
      currentSize + MAX_BUFFER_GROWTH_PER_TRANSACTION,
      minBufferSize
    );
    const trx = await r.increaseObservationCardinalityNext(newSize);
    await trx.wait();
    process.stdout.write(`.`);
    currentSize = (await r.oracleVars())[2];
  }

  if (bufferWasTooSmall) {
    console.log(" Done.");
  }

  const currentSecondsSinceLastUpdate = (
    await r.minSecondsSinceLastUpdate()
  ).toNumber();
  // console.log( `current minSecondsSinceLastUpdate of ${r.address} is ${currentVal}` );

  if (currentSecondsSinceLastUpdate !== minSecondsSinceLastUpdate) {
    const trx = await r.setMinSecondsSinceLastUpdate(minSecondsSinceLastUpdate);
    await trx.wait();
    console.log(
      `Updated minSecondsSinceLastUpdate of ${r.address} to ${minSecondsSinceLastUpdate}`
    );
  }
};
