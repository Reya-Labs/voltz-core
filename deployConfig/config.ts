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
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
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
  marginEngineLiquidatorRewardWad: toBn(0.1),
  marginEngineCalculatorParameters: marginCalculatorDefaults1,
  vammFeeProtocol: 10,
  vammFeeWad: toBn(0.009), // 0.9%, for 30 day pool
  maxIrsDurationInSeconds: 60 * 60 * 24 * 92, // 92 days. Do not increase without checking that rate oracle buffers are large enough
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
  maxIrsDurationInSeconds: 60 * 60 * 24 * 30, // 30 days. Do not increase without checking that rate oracle buffers are large enough
};
const localhostRateOracleConfigDefaults = {
  ...kovanRateOracleConfigDefaults,
  rateOracleMinSecondsSinceLastUpdate: 60 * 60, // 1 hour
  rateOracleBufferSize: 1000,
};

const kovanTusdDataPoints: RateOracleDataPoint[] = [
  [1651328512, "1169761008875861964432213844"],
  [1651408548, "1170853556378555583878384899"],
  [1651492104, "1171884376787612229181889519"],
  [1651514792, "1172194135974953748529199145"],
  [1651539896, "1172681121951755878562952857"],
  [1651561616, "1173102619673147126782274434"],
  [1651583344, "1173524630967783524934607721"],
  [1651605548, "1173961890093758141214435884"],
  [1651627440, "1174396161770605384118680563"],
  [1651649072, "1174825308553883610858650890"],
  [1651671204, "1175264710270468345612748451"],
  [1651695080, "1175738736810554064345300115"],
  [1651719332, "1176220228335523022742931331"],
  [1651740940, "117664985657398114295162823"],
];

const mainnetStEthDataPoints: RateOracleDataPoint[] = [
  [1651879799, "1070485578483524870126761205"],
  [1652516485, "1071226893624992827247560170"],
  [1653154520, "1072111386102180338298911312"],
  [1653721964, "1072807737405152312769803194"],
  [1654456927, "1073871010466494060427628061"],
  [1655050461, "1074697726413162893057905270"],
];

const mainnetRocketEthDataPoints: RateOracleDataPoint[] = [
  [1652583270, "1024583990875469414982436935"],
  [1653143338, "1025254611747488178020328436"],
  [1653711038, "1025922983935784513304611982"],
  [1654277948, "1026599253986324262373044488"],
  [1654868735, "1027304108017384923832661768"],
];

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
        trustedDataPoints: kovanTusdDataPoints,
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
    defaults: {
      rateOracleBufferSize: 200,
      trustedDataPoints: mainnetStEthDataPoints,
      rateOracleMinSecondsSinceLastUpdate: 18 * 60 * 60, // Lido rates only get updated once a day
    },
  },
  rocketPoolConfig: {
    // RocketPool deployment info at ???
    rocketPoolRocketToken: "0xae78736cd615f374d3085123a210448e74fc6393",
    defaults: {
      rateOracleBufferSize: 200,
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
  compoundConfig: {
    compoundTokens: [],
    defaults: localhostRateOracleConfigDefaults,
  },
};

const config: ContractsConfigMap = {
  kovan: kovanConfig,
  rinkeby: rinkebyConfig,
  // localhost: mainnetConfig, // Uncomment if testing against a fork of an existing mainnet system
  localhost: localhostConfig,
  mainnet: mainnetConfig,
  // hardhat: kovanConfig, // uncomment if testing against a kovan fork
  // hardhat: { ...mainnetConfig, skipFactoryDeploy: false, }, // uncomment if deploying a new system against a mainnet fork
  hardhat: localhostConfig,
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
