import type { ContractsConfig, RateOracleDataPoint } from "./types";

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

const mainnetRocketEthDataPoints: RateOracleDataPoint[] = [
  [1654153801, "1026502356712851858611688825"],
  [1654400221, "1026793795816522881011714495"],
  [1654653662, "1027094919285384123607191853"],
  [1654908339, "1027407532010818332514656018"],
  [1655163630, "1027711269610859760832754547"],
  [1655422235, "1028020261352758203022591045"],
  [1655679498, "1028327594600088450724742946"],
  [1655948265, "1028648713128345690215441392"],
  [1656227854, "1028983791573806158062493864"],
  [1656507451, "1029316227654002773627484408"],
  [1656678850, "1029523618065120550016203495"],
  [1656909442, "1029803630340691797390055876"],
  [1657140236, "1030082929186402994490724061"],
  [1657371441, "1030363035676219783347593823"],
  [1657600825, "1030629617919391988360741953"],
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
const borrowAaveETHMainnetTrustedDatapoints: RateOracleDataPoint[] = [
  [1659293973, "1017417175429003949143107039"],
  [1659382348, "1017471802986665011065209143"],
  [1659470806, "1017525640360579629633466462"],
  [1659559993, "1017578765384909374975329286"],
  [1659648753, "1017631928407994312079157903"],
  [1659736491, "1017683931915409922815303280"],
  [1659824625, "1017736749717512736590360219"],
  [1659912836, "1017789758590383638303157512"],
  [1660001499, "1017848260571161228686360933"],
  [1660090543, "1017916178049588760305116077"],
  [1660179947, "1017988178468620837605923661"],
];
const borrowCompoundUSDTMainnetTrustedDatapoints: RateOracleDataPoint[] = [
  [1659293973, "1156590158125246633000000000"],
  [1659382348, "1156693385846164973000000000"],
  [1659470806, "1156793370044702816000000000"],
  [1659559993, "1156892192141848963000000000"],
  [1659648753, "1156989357004268035000000000"],
  [1659736491, "1157084706324075158000000000"],
  [1659824625, "1157180280453827599000000000"],
  [1659912836, "1157276004386729727000000000"],
  [1660001499, "1157371708996419260000000000"],
  [1660090543, "1157466770574331849000000000"],
  [1660179947, "1157559434764917645000000000"],
];

const ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS = {
  rateOracleBufferSize: 500,
  minSecondsSinceLastUpdate: 18 * 60 * 60, // 18 hours
};

export const mainnetConfig: ContractsConfig = {
  maxIrsDurationInSeconds: 60 * 60 * 24 * 9 * 31, // 9 months. Do not increase without checking that rate oracle buffers are large enough
  weth: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  aaveConfig: {
    // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
    aaveLendingPool: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
    aaveTokens: [
      // Supply markets
      {
        name: "USDC",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      },
      {
        name: "DAI",
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      },
      {
        name: "WETH",
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        daysOfTrustedDataPoints: 20,
      },
      // Borrow markets
      {
        name: "USDC",
        borrow: true,
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        trustedDataPoints: borrowAaveUSDCMainnetTrustedDatapoints,
      },
      {
        name: "WETH",
        borrow: true,
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        trustedDataPoints: borrowAaveETHMainnetTrustedDatapoints,
      },
      // {
      //   name: "DAI",
      //   borrow: true,
      //   address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      //   ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      //   trustedDataPoints: borrowAaveDAIMainnetTrustedDatapoints,
      // },
    ],
  },
  compoundConfig: {
    compoundTokens: [
      {
        name: "cDAI",
        address: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      },
    ],
  },
  compoundBorrowConfig: {
    compoundTokens: [
      {
        name: "cUSDT",
        address: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
        ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
        trustedDataPoints: borrowCompoundUSDTMainnetTrustedDatapoints,
      },
      // {
      //   name: "cETH",
      //   address: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
      //   ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      // },
    ],
  },
  lidoConfig: {
    // Lido deployment info at https://github.com/lidofinance/lido-dao/tree/816bf1d0995ba5cfdfc264de4acda34a7fe93eba#mainnet
    lidoStETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    lidoOracle: "0x442af784A788A5bd6F42A01Ebe9F287a871243fb",
    defaults: {
      ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      trustedDataPoints: mainnetStEthDataPoints,
    },
  },
  rocketPoolConfig: {
    // RocketPool deployment info at ???
    rocketPoolRocketToken: "0xae78736cd615f374d3085123a210448e74fc6393",
    rocketNetworkBalances: "0x138313f102ce9a0662f826fca977e3ab4d6e5539",
    defaults: {
      ...ONE_YEAR_OF_EIGHTEEN_HOURLY_DATAPOINTS,
      trustedDataPoints: mainnetRocketEthDataPoints,
    },
  },
  skipFactoryDeploy: true, // On mainnet we use a community deployer
  factoryOwnedByMultisig: true, // On mainnet, transactions to the factory must go through a multisig
};
