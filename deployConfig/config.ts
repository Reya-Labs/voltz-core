import type {
  ConfigDefaults,
  ContractsConfigMap,
  RateOracleDataPoint,
  TokenConfig,
} from "./types";
// import { network } from "hardhat"; // Not importable from tasks
import { toBn } from "../test/helpers/toBn";

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
  fixedRateDeviationMinLeftUnwindLMWad: toBn(0.1),
  fixedRateDeviationMinRightUnwindLMWad: toBn(0.1),
  fixedRateDeviationMinLeftUnwindIMWad: toBn(0.3),
  fixedRateDeviationMinRightUnwindIMWad: toBn(0.3),
  gammaWad: toBn(1),
  minMarginToIncentiviseLiquidators: 0,
};

const kovanConfigDefaults: ConfigDefaults = {
  marginEngineLookbackWindowInSeconds: 60 * 60 * 6, // 6 hours
  // marginEngineLookbackWindowInSeconds: 1209600, // 2 weeks
  marginEngineCacheMaxAgeInSeconds: 6 * 60 * 60, // 6 hours
  marginEngineLiquidatorRewardWad: toBn(0.1),
  marginEngineCalculatorParameters: marginCalculatorDefaults1,
  vammFeeProtocol: 10,
  vammFeeWad: toBn(0.009), // 0.9%, for 30 day pool
  rateOracleBufferSize: 200, // For mock token oracle
  rateOracleMinSecondsSinceLastUpdate: 6 * 60 * 60, // FOr mock token oracle. 6 hours
};

const localhostConfigDefaults = {
  ...kovanConfigDefaults,
  marginEngineLookbackWindowInSeconds: 60 * 60, // 1 hour
  marginEngineCacheMaxAgeInSeconds: 60 * 60, // 1 hour
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

const kovanConfig = {
  // See deployment info at https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
  aaveLendingPool: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
  maxIrsDurationInSeconds: 60 * 60 * 24 * 32, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  // maxIrsDurationInSeconds: 60 * 60 * 24 * 62, // 32 days. Do not increase without checking that rate oracle buffers are large enough
  configDefaults: kovanConfigDefaults,

  // Kovan MockUSDT (USDC has no ABI and faucet not working, so USDT easier to mint)
  // See tokens list at https://aave.github.io/aave-addresses/kovan.json
  // Mint some here: https://kovan.etherscan.io/address/0x13512979ADE267AB5100878E2e0f485B568328a4#writeContract
  aaveTokens: [
    {
      name: "USDT",
      address: "0x13512979ADE267AB5100878E2e0f485B568328a4",
      rateOracleBufferSize: 200,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
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
      name: "UNI",
      address: "0x075A36BA8846C6B6F53644fDd3bf17E5151789DC",
      rateOracleBufferSize: 200,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
    {
      name: "BAT",
      address: "0x2d12186fbb9f9a8c28b3ffdd4c42920f8539d738",
      rateOracleBufferSize: 200,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
    {
      name: "BUSD",
      address: "0x4c6E1EFC12FDfD568186b7BAEc0A43fFfb4bCcCf",
      rateOracleBufferSize: 200,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
    {
      name: "REN",
      address: "0x5eebf65a6746eed38042353ba84c8e37ed58ac6f",
      rateOracleBufferSize: 200,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
    {
      name: "MRK",
      address: "0x61e4CAE3DA7FD189e52a4879C7B8067D7C2Cc0FA",
      rateOracleBufferSize: 200,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
  ],
  // See tokens list at https://compound.finance/docs#networks
  compoundTokens: [
    {
      name: "cUSDC",
      address: "0x4a92e71227d294f041bd82dd8f78591b75140d63",
      rateOracleBufferSize: 300,
      minSecondsSinceLastUpdate: 6 * 60 * 60, // 6 hours
    },
  ],
};

const config: ContractsConfigMap = {
  kovan: kovanConfig,
  localhost: {
    maxIrsDurationInSeconds: 60 * 60 * 24 * 30, // 30 days. Do not increase without checking that rate oracle buffers are large enough
    configDefaults: localhostConfigDefaults,
  },
  // hardhat: kovanConfig, // uncomment if testing against a kovan fork
  hardhat: {
    maxIrsDurationInSeconds: 60 * 60 * 24 * 30, // 30 days. Do not increase without checking that rate oracle buffers are large enough
    configDefaults: localhostConfigDefaults,
  },
};

export const getAaveLendingPoolAddress = (
  _networkName: string
): string | undefined => {
  // const networkName = _networkName || network.name;
  return config[_networkName]
    ? config[_networkName].aaveLendingPool
    : undefined;
};

export const getMaxDurationOfIrsInSeconds = (_networkName: string): number => {
  // const networkName = _networkName || network.name;
  return config[_networkName].maxIrsDurationInSeconds;
};

export const getAaveTokens = (
  _networkName: string
): TokenConfig[] | undefined => {
  // const networkName = _networkName || network.name;

  const aaveTokens = config[_networkName]
    ? config[_networkName].aaveTokens
    : undefined;
  // Check for duplicate token names. These must be unique because they are used to name the deployed contracts
  if (aaveTokens && duplicateExists(aaveTokens?.map((t) => t.name))) {
    throw Error(
      `Duplicate token names configured for Aave on network ${_networkName}`
    );
  }
  return aaveTokens;
};

export const getCompoundTokens = (
  _networkName: string
): TokenConfig[] | undefined => {
  const networkName = _networkName;

  const compoundTokens = config[networkName]
    ? config[networkName].compoundTokens
    : undefined;
  // Check for duplicate token names. These must be∫ unique because they are used to name the deployed contracts
  if (compoundTokens && duplicateExists(compoundTokens?.map((t) => t.name))) {
    throw Error(
      `Duplicate token names configured for Compound on network ${_networkName}`
    );
  }
  return compoundTokens;
};

export const getConfigDefaults = (_networkName: string): ConfigDefaults => {
  if (!config[_networkName] || !config[_networkName].configDefaults) {
    throw new Error(
      `No default deployment config set for network ${_networkName}`
    );
  }
  // const networkName = _networkName || network.name;
  return config[_networkName].configDefaults;
};
