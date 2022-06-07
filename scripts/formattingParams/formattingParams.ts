import { toBn } from "evm-bn";
import { encodeSqrtRatioX96 } from "../../test/shared/utilities";
import * as params from "./aUSDC-60/rawParams.json";

console.log(params);

const mcParams = [];

/// apyUpperMultiplierWad
mcParams.push(toBn(params.tau_u.toString()).toString());

/// apyLowerMultiplierWad
mcParams.push(toBn(params.tau_d.toString()).toString());

/// sigmaSquaredWad;
mcParams.push(toBn(params.sigma_squared.toString()).toString());

/// alphaWad;
mcParams.push(toBn(params.alpha.toString()).toString());

/// betaWad;
mcParams.push(toBn(params.beta.toString()).toString());

/// xiUpperWad;
mcParams.push(toBn(params.xiUpper.toString()).toString());

/// xiLowerWad;
mcParams.push(toBn(params.xiLower.toString()).toString());

/// tMaxWad;
mcParams.push(toBn(params.tMax.toString()).toString());

/// devMulLeftUnwindLMWad;
mcParams.push(toBn(params.dev_lm.toString()).toString());

/// devMulRightUnwindLMWad;
mcParams.push(toBn(params.dev_lm.toString()).toString());

/// devMulLeftUnwindIMWad;
mcParams.push(toBn(params.dev_im.toString()).toString());

/// devMulRightUnwindIMWad;
mcParams.push(toBn(params.dev_im.toString()).toString());

/// fixedRateDeviationMinLeftUnwindLMWad;
mcParams.push(toBn(params.r_init_lm.toString()).toString());

/// fixedRateDeviationMinRightUnwindLMWad;
mcParams.push(toBn(params.r_init_lm.toString()).toString());

/// fixedRateDeviationMinLeftUnwindIMWad;
mcParams.push(toBn(params.r_init_im.toString()).toString());

/// fixedRateDeviationMinRightUnwindIMWad;
mcParams.push(toBn(params.r_init_im.toString()).toString());

/// gammaWad;
mcParams.push(toBn(params.gamma.toString()).toString());

/// minMarginToIncentiviseLiquidators;
mcParams.push(
  (params.minMarginToIncentiviseLiquidators * 10 ** params.decimals).toString()
);

console.log("mcParams:", mcParams);
console.log();

console.log(
  "termStartTimestampWad:",
  toBn(params.startTimestamp.toString()).toString()
);
console.log();

console.log(
  "termEndTimestampWad:",
  toBn(params.endTimestamp.toString()).toString()
);
console.log();

console.log("feeWad:", toBn(params.vammFee.toString()).toString());
console.log();

console.log("lookBackWind:", (params.lookback * 24 * 60 * 60).toString());
console.log();

console.log("starting fixed rate aUSDC", encodeSqrtRatioX96(1, 1).toString());

console.log(
  "starting fixed rate aDAI",
  encodeSqrtRatioX96(100, 152).toString()
);

console.log(
  "starting fixed rate cDAI",
  encodeSqrtRatioX96(100, 120).toString()
);

console.log(
  "liquidatorRewardWad:",
  toBn(params.liquidatorReward.toString()).toString()
);
