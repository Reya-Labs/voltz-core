import { BigNumber, ethers, utils } from "ethers";
import * as factory from "./../artifacts/contracts/Factory.sol/Factory.json";

export const iface = new ethers.utils.Interface(factory.abi);

export const errorMessageMapping: { [errSig: string]: string } = {
  LOK: "The pool has not been initialized yet",
  CanOnlyTradeIfUnlocked: "The pool has not been initialized yet",
  closeToOrBeyondMaturity: "The pool is close to or beyond maturity",
  TLU: "Lower Fixed Rate must be smaller than Upper Fixed Rate",
  TLM: "Lower Fixed Rate is too low",
  TUM: "Upper Fixed Rate is too high",
  "only sender or approved integration":
    "No approval to act on this address behalf",
  "MS or ME": "No approval to act on this address behalf",
  "only msg.sender or approved can mint":
    "No approval to act on this address behalf",

  "E<=S": "Internal error: The timestamps of the pool are not correct",

  "B.T<S":
    "Internal error: Operations need current timestamp to be before maturity",

  "endTime must be >= currentTime":
    "Internal error: Operations need current timestamp to be before maturity",

  "parameters not set": "Internal error: Margin Calculator parameters not set",

  SPL: "No notional available in that direction",

  MarginRequirementNotMet: "No enough margin for this operation",

  NP: "Active positions should have positive liquidity",

  LO: "Internal Error: Liquidity exceeds maximum amount per tick",

  "not enough liquidity to burn": "Not enough liquidity to burn",

  PositionNotSettled: "The position needs to be settled first",

  WithdrawalExceedsCurrentMargin: "No enough margin to withdraw",

  MarginLessThanMinimum: "No enough margin for this operation",

  InvalidMarginDelta: "Amount of notional must be greater than 0!",

  LiquidityDeltaMustBePositiveInMint:
    "Internal error: Liquidity for mint should be positive",

  LiquidityDeltaMustBePositiveInBurn:
    "Internal error: Liquidity for burn should be positive",

  IRSNotionalAmountSpecifiedMustBeNonZero:
    "Amount of notional must be greater than 0!",

  "tick must be properly spaced":
    "Internal error: Ticks must be properly spaced!",

  TSOFLOW: "Internal error: Timestamp overflows",

  "already settled": "Position already settled",

  "from > to":
    "Internal error: Rates disorder when getting rate in the rate oracle",

  "Misordered dates":
    "Internal error: Rates disorder when getting apy in the rate oracle",

  UNITS:
    "Internal error: Timestamps not initialized when getting variable factor",

  ">216": "Internal error: Observation overflows in the rate oracle",

  "New size of oracle buffer should be positive":
    "New size of oracle buffer should be positive",

  OLD: "Internal error: Rate oracle not matured enough",

  "x must be > 0": "Internal error: the value must be positive in BitMath",

  "SafeMath: addition overflow": "Internal error: addition overflow",

  "SafeMath: subtraction overflow": "ERC20: transfer amount exceeds balance",

  "SafeMath: multiplication overflow":
    "Internal error: multiplication overflow",

  "ERC20: transfer from the zero address":
    "Internal error: ERC20: transfer from the zero address",

  "ERC20: transfer to the zero address":
    "Internal error: ERC20: transfer to the zero address",

  "ERC20: transfer amount exceeds balance":
    "ERC20: transfer amount exceeds balance",

  "ERC20: mint to the zero address": "ERC20: mint to the zero address",

  "ERC20: burn from the zero address": "ERC20: burn from the zero address",

  "ERC20: burn amount exceeds balance": "ERC20: burn amount exceeds balance",

  "ERC20: approve from the zero address":
    "ERC20: approve from the zero address",

  "ERC20: approve to the zero address": "ERC20: approve to the zero address",

  CT_CALLER_MUST_BE_LENDING_POOL: "Internal error: Caller must lending pool",

  CT_INVALID_MINT_AMOUNT: "Internal error: Invalid aToken amount to mint",

  CT_INVALID_BURN_AMOUNT: "Internal error: Invalid aToken amount to burn",

  "Division by zero": "Internal error: Division by zero in aToken",

  overflow: "Internal error: Overflow in aToken",

  "overflow in toUint160": "Internal error: Overflow when casting to Uint160",

  "overflow in toInt128": "Internal error: Overflow when casting to Int128",

  "overflow in toInt256": "Internal error: Overflow when casting to Int256",

  "denominator underflows":
    "Internal error: Denominator underflows in SqrtPriceMath",

  "starting px must be > quotient":
    "Internal error: Next price should be higher than current price in SqrtPriceMath",

  "starting price must be > 0":
    "Internal error: Starting price not initialized in SqrtPriceMath",

  "liquidity must be > 0":
    "Internal error: Liquidity must be positive in tick range",

  "tick outside of range": "Internal error: Tick outside of range in TickMath",

  "price outside of range":
    "Internal error: Price outside of range in TickMath",

  "Wad Ray Math: 49": "Internal error: addition overflow in WadRayMath",

  "Wad Ray Math: 50": "Internal error: division by zero in WadRayMath",

  /// @dev No need to unwind a net zero position
  PositionNetZero: "No need to unwind a net zero position",

  /// The position/trader needs to be below the liquidation threshold to be liquidated
  CannotLiquidate: "Position is not liquidatable",

  /// Only the position/trade owner can update the LP/Trader margin
  OnlyOwnerCanUpdatePosition: "No approval to update this position",

  OnlyVAMM: "No approval for this operation",

  OnlyFCM: "No approval for this operation",

  /// Positions and Traders cannot be settled before the applicable interest rate swap has matured
  CannotSettleBeforeMaturity: "Cannot settle before maturity",

  /// @dev There are not enough funds available for the requested operation
  NotEnoughFunds: "No enough funds to perform this operation",

  /// @dev The two values were expected to have oppostite sigs, but do not
  ExpectedOppositeSigns: "Internal error",

  /// @dev Error which is reverted if the sqrt price of the vamm is non-zero before a vamm is initialized
  ExpectedSqrtPriceZeroBeforeInit: "Internal error",

  /// @dev only the margin engine can run a certain function
  OnlyMarginEngine: "No approval for this operation",

  /// The resulting margin does not meet minimum requirements
  MarginRequirementNotMetFCM: "No enough margin to perform this operation",

  /// @dev getReserveNormalizedIncome returned zero for underlying asset. Oracle only supports active Aave-V2 assets.
  AavePoolGetReserveNormalizedIncomeReturnedZero: "Internal error",

  /// @dev currentTime < queriedTime
  OOO: "Internal error",

  // @dev safeTransferLib error
  "STL fail": "Insufficient balance",

  "Insufficient balance": "Insufficient balance",
};

export const extractErrorSignature = (message: string): string => {
  // eslint-disable-next-line no-restricted-syntax
  for (const errSig in errorMessageMapping) {
    if (message.includes(errSig)) {
      return errSig;
    }
  }
  throw new Error("Unrecognized error signature");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getErrorSignature = (error: any, environment: string): string => {
  switch (environment) {
    case "LOCALHOST_SDK": {
      try {
        const message = error.message as string;
        const errSig = extractErrorSignature(message);
        return errSig;
      } catch {
        throw new Error("Unrecognized error type");
      }
    }
    case "LOCALHOST_UI": {
      try {
        const message = error.data.message as string;
        const errSig = extractErrorSignature(message);
        return errSig;
      } catch {
        throw new Error("Unrecognized error type");
      }
    }
    case "KOVAN": {
      try {
        const reason = error.data.toString().replace("Reverted ", "") as string;
        if (reason.startsWith("0x08c379a0")) {
          return "Error";
        }
        const decodedError = iface.parseError(reason);
        const errSig = decodedError.signature.split("(")[0];
        return errSig;
      } catch {
        throw new Error("Unrecognized error type");
      }
    }
    case "MAINNET": {
      try {
        console.log("raw error:", error);
        const stringifiedError = error.toString();
        console.log("stringified error:", stringifiedError);
        const afterOriginalError = stringifiedError.split("originalError")[1];
        const afterData = afterOriginalError.split("data")[1];
        const beforeMessage = afterData.split("message")[0];
        const reason = beforeMessage.substring(3, beforeMessage.length - 3);

        if (reason.startsWith("0x08c379a0")) {
          return "Error";
        }
        const decodedError = iface.parseError(reason);
        const errSig = decodedError.signature.split("(")[0];
        return errSig;
      } catch {
        throw new Error("Unrecognized error type");
      }
    }
    default: {
      throw new Error("Unrecognized network for decoding errors");
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getReadableErrorMessage = (
  error: any,
  environment: string
): string => {
  const errSig = getErrorSignature(error, environment);
  if (errSig === "Error") {
    switch (environment) {
      case "LOCALHOST_SDK": {
        throw new Error(
          "Cannot get errSig Error in LOCALHOST_SDK. Inspect raw error!"
        );
      }
      case "LOCALHOST_UI": {
        throw new Error(
          "Cannot get errSign Error in LOCALHOST_UI. Inspect raw error!"
        );
      }
      case "KOVAN": {
        let reason = error.data.toString().replace("Reverted ", "") as string;
        reason = `0x${reason.substring(10)}`;
        try {
          const rawErrorMessage = utils.defaultAbiCoder.decode(
            ["string"],
            reason
          )[0];

          if (rawErrorMessage in errorMessageMapping) {
            return errorMessageMapping[rawErrorMessage];
          }

          return `Unrecognized error (Raw error: ${rawErrorMessage})`;
        } catch (_) {
          return "Unrecognized error";
        }
      }
      case "MAINNET": {
        const stringifiedError = error.toString();
        const afterOriginalError = stringifiedError.split("originalError")[1];
        const afterData = afterOriginalError.split("data")[1];
        const beforeMessage = afterData.split("message")[0];
        let reason = beforeMessage.substring(3, beforeMessage.length - 3);
        reason = `0x${reason.substring(10)}`;

        try {
          const rawErrorMessage = utils.defaultAbiCoder.decode(
            ["string"],
            reason
          )[0];

          if (rawErrorMessage in errorMessageMapping) {
            return errorMessageMapping[rawErrorMessage];
          }

          return `Unrecognized error (Raw error: ${rawErrorMessage})`;
        } catch (_) {
          return "Unrecognized error";
        }
      }
      default: {
        throw new Error("Unrecognized network for decoding errors");
      }
    }
  }
  if (errSig in errorMessageMapping) {
    return errorMessageMapping[errSig];
  }
  return "Unrecognized error";
};

export type RawInfoPostMint = {
  marginRequirement: BigNumber;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const decodeInfoPostMint = (
  error: any,
  environment: string
): RawInfoPostMint => {
  const errSig = getErrorSignature(error, environment);
  if (errSig === "MarginLessThanMinimum") {
    switch (environment) {
      case "LOCALHOST_SDK": {
        try {
          const message = error.message as string;
          const args: string[] = message
            .split(errSig)[1]
            .split("(")[1]
            .split(")")[0]
            .replaceAll(" ", "")
            .split(",");

          const result = { marginRequirement: BigNumber.from(args[0]) };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      case "LOCALHOST_UI": {
        try {
          const message = error.data.message as string;
          const args: string[] = message
            .split(errSig)[1]
            .split("(")[1]
            .split(")")[0]
            .replaceAll(" ", "")
            .split(",");

          const result = { marginRequirement: BigNumber.from(args[0]) };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      case "KOVAN": {
        try {
          const reason = error.data.toString().replace("Reverted ", "");
          const decodingResult = iface.decodeErrorResult(errSig, reason);
          const result = {
            marginRequirement: decodingResult.marginRequirement,
          };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      case "MAINNET": {
        try {
          const stringifiedError = error.toString();
          const afterOriginalError = stringifiedError.split("originalError")[1];
          const afterData = afterOriginalError.split("data")[1];
          const beforeMessage = afterData.split("message")[0];
          const reason = beforeMessage.substring(3, beforeMessage.length - 3);

          const decodingResult = iface.decodeErrorResult(errSig, reason);
          const result = {
            marginRequirement: decodingResult.marginRequirement,
          };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      default: {
        throw new Error("Unrecognized network for decoding errors");
      }
    }
  }
  throw new Error(getReadableErrorMessage(error, environment));
};

export type RawInfoPostSwap = {
  marginRequirement: BigNumber;
  tick: number;
  fee: BigNumber;
  availableNotional: BigNumber;
  fixedTokenDeltaUnbalanced: BigNumber;
  fixedTokenDelta: BigNumber;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const decodeInfoPostSwap = (
  error: any,
  environment: string
): RawInfoPostSwap => {
  const errSig = getErrorSignature(error, environment);
  if (errSig === "MarginRequirementNotMet") {
    switch (environment) {
      case "LOCALHOST_SDK": {
        try {
          const message = error.message as string;
          const args: string[] = message
            .split(errSig)[1]
            .split("(")[1]
            .split(")")[0]
            .replaceAll(" ", "")
            .split(",");

          const result = {
            marginRequirement: BigNumber.from(args[0]),
            tick: parseInt(args[1], 10),
            fee: BigNumber.from(args[4]),
            availableNotional: BigNumber.from(args[3]),
            fixedTokenDelta: BigNumber.from(args[2]),
            fixedTokenDeltaUnbalanced: BigNumber.from(args[5]),
          };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      case "LOCALHOST_UI": {
        try {
          const message = error.data.message as string;
          const args: string[] = message
            .split(errSig)[1]
            .split("(")[1]
            .split(")")[0]
            .replaceAll(" ", "")
            .split(",");

          const result = {
            marginRequirement: BigNumber.from(args[0]),
            tick: parseInt(args[1], 10),
            fee: BigNumber.from(args[4]),
            availableNotional: BigNumber.from(args[3]),
            fixedTokenDelta: BigNumber.from(args[2]),
            fixedTokenDeltaUnbalanced: BigNumber.from(args[5]),
          };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      case "KOVAN": {
        try {
          const reason = error.data.toString().replace("Reverted ", "");
          const decodingResult = iface.decodeErrorResult(errSig, reason);
          const result = {
            marginRequirement: decodingResult.marginRequirement,
            tick: decodingResult.tick,
            fee: decodingResult.cumulativeFeeIncurred,
            availableNotional: decodingResult.variableTokenDelta,
            fixedTokenDelta: decodingResult.fixedTokenDelta,
            fixedTokenDeltaUnbalanced: decodingResult.fixedTokenDeltaUnbalanced,
          };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      case "MAINNET": {
        try {
          const stringifiedError = error.toString();
          const afterOriginalError = stringifiedError.split("originalError")[1];
          const afterData = afterOriginalError.split("data")[1];
          const beforeMessage = afterData.split("message")[0];
          const reason = beforeMessage.substring(3, beforeMessage.length - 3);

          const decodingResult = iface.decodeErrorResult(errSig, reason);
          const result = {
            marginRequirement: decodingResult.marginRequirement,
            tick: decodingResult.tick,
            fee: decodingResult.cumulativeFeeIncurred,
            availableNotional: decodingResult.variableTokenDelta,
            fixedTokenDelta: decodingResult.fixedTokenDelta,
            fixedTokenDeltaUnbalanced: decodingResult.fixedTokenDeltaUnbalanced,
          };
          return result;
        } catch {
          throw new Error("Unrecognized error type");
        }
      }
      default: {
        throw new Error("Unrecognized network for decoding errors");
      }
    }
  }
  throw new Error(getReadableErrorMessage(error, environment));
};
