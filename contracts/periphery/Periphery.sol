pragma solidity ^0.8.0;

pragma abicoder v2;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../utils/TickMath.sol";
import "./peripheral_libraries/LiquidityAmounts.sol";
import "hardhat/console.sol";

// margin calculation functions
contract Periphery {
    struct MintOrBurnParams {
        address marginEngineAddress;
        address recipient;
        int24 tickLower;
        int24 tickUpper;
        uint256 notional;
        bool isMint;
    }

    function getMarginEngine(address marginEngineAddress)
        internal
        pure
        returns (IMarginEngine)
    {
        IMarginEngine marginEngine = IMarginEngine(marginEngineAddress);
        return marginEngine;
    }

    function getVAMM(address marginEngineAddress)
        internal
        view
        returns (IVAMM)
    {
        IMarginEngine marginEngine = getMarginEngine(marginEngineAddress);

        IVAMM vamm = marginEngine.vamm();

        return vamm;
    }

    /// @notice Add liquidity to an initialized pool
    function mintOrBurn(MintOrBurnParams memory params)
        external
        returns (int256 positionMarginRequirement)
    {
        require(
            msg.sender == params.recipient,
            "msg.sender must be the recipient"
        );

        IVAMM vamm = getVAMM(params.marginEngineAddress);

        // compute the liquidity amount for the amount of notional (amount1) specified

        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(params.tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(params.tickUpper);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
            sqrtRatioAX96,
            sqrtRatioBX96,
            params.notional
        );

        console.log("liquidity", liquidity);
        positionMarginRequirement = 0;
        if (params.isMint) {
            positionMarginRequirement = vamm.mint(
                params.recipient,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        } else {
            // invoke a burn
            positionMarginRequirement = vamm.burn(
                params.recipient,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        }
    }

    struct SwapPeripheryParams {
        address marginEngineAddress;
        address recipient;
        bool isFT;
        uint256 notional;
        uint160 sqrtPriceLimitX96;
        int24 tickLower;
        int24 tickUpper;
    }

    function swap(SwapPeripheryParams memory params)
        external
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement
        )
    {
        require(
            msg.sender == params.recipient,
            "msg.sender must be the recipient"
        );

        IVAMM vamm = getVAMM(params.marginEngineAddress);

        int256 amountSpecified;

        if (params.isFT) {
            amountSpecified = int256(params.notional);
        } else {
            amountSpecified = -int256(params.notional);
        }

        int24 tickSpacing = vamm.tickSpacing();

        IVAMM.SwapParams memory swapParams = IVAMM.SwapParams({
            recipient: msg.sender,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: params.sqrtPriceLimitX96 == 0
                ? (
                    !params.isFT
                        ? TickMath.MIN_SQRT_RATIO + 1
                        : TickMath.MAX_SQRT_RATIO - 1
                )
                : params.sqrtPriceLimitX96,
            tickLower: params.tickLower == 0 ? -tickSpacing : params.tickLower,
            tickUpper: params.tickUpper == 0 ? tickSpacing : params.tickUpper
        });

        return vamm.swap(swapParams);
    }

    // // should be called only with callStatic
    // function swapQouter(SwapPeripheryParams memory params)
    //     external
    //     returns (
    //         int256,
    //         int24 tickBefore,
    //         int24,
    //         int256,
    //         int256,
    //         uint256,
    //         int256
    //     )
    // {
    //     require(
    //         msg.sender == params.recipient || msg.sender == address(this),
    //         "msg.sender must be the recipient"
    //     );

    //     GetSwapQuoter memory result;

    //     IVAMM vamm = getVAMM(params.marginEngineAddress);
    //     (, tickBefore, ) = vamm.vammVars();

    //     int256 amountSpecified;

    //     if (params.isFT) {
    //         amountSpecified = int256(params.notional);
    //     } else {
    //         amountSpecified = -int256(params.notional);
    //     }

    //     int24 tickSpacing = vamm.tickSpacing();

    //     IVAMM.SwapParams memory swapParams = IVAMM.SwapParams({
    //         recipient: msg.sender,
    //         amountSpecified: amountSpecified,
    //         sqrtPriceLimitX96: params.sqrtPriceLimitX96 == 0
    //             ? (
    //                 !params.isFT
    //                     ? TickMath.MIN_SQRT_RATIO + 1
    //                     : TickMath.MAX_SQRT_RATIO - 1
    //             )
    //             : params.sqrtPriceLimitX96,
    //         isExternal: false,
    //         tickLower: params.tickLower == 0 ? -tickSpacing : params.tickLower,
    //         tickUpper: params.tickUpper == 0 ? tickSpacing : params.tickUpper
    //     });

    //     try vamm.swap(swapParams) returns (int256 _fixedTokenDelta, int256 _variableTokenDelta, uint256 _cumulativeFeeIncurred, int256 _fixedTokenDeltaUnbalanced, int256 positionMarginRequirement) {
    //         result.fixedTokenDelta = _fixedTokenDelta;
    //         result.variableTokenDelta = _variableTokenDelta;
    //         result.cumulativeFeeIncurred = _cumulativeFeeIncurred;
    //         result.fixedTokenDeltaUnbalanced = _fixedTokenDeltaUnbalanced;
    //         result.marginRequirement = positionMarginRequirement;
    //         (, result.tickAfter, ) = vamm.vammVars();
    //     } catch (bytes memory reason) {
    //         bytes memory errorName = new bytes(4);
    //         errorName[0] = reason[0];
    //         errorName[1] = reason[1];
    //         errorName[2] = reason[2];
    //         errorName[3] = reason[3];
    //         console.log(bytesToString(abi.encodePacked("MarginRequirementNotMet()")));

    //         // bytes32 actualError = keccak256(abi.encodeWithSignature("MarginRequirementNotMet()"));

    //         // console.log(bytes32ToString(actualError));
    //         // bytes memory actualErrorName = new bytes(4);
    //         // actualErrorName[0] = actualError[0];
    //         // actualErrorName[1] = actualError[1];
    //         // actualErrorName[2] = actualError[2];
    //         // actualErrorName[3] = actualError[3];

    //         // if (actualErrorName[0] == errorName[0] &&
    //         //     actualErrorName[1] == errorName[1] &&
    //         //     actualErrorName[2] == errorName[2] &&
    //         //     actualErrorName[3] == errorName[3]) {
    //         //         console.log("the same");
    //         //     }
    //         // else {
    //         //     console.log((actualErrorName[0]));
    //         // }

    //         if (true) {
    //             assembly {
    //                 reason := add(reason, 0x04)
    //             }

    //             (result) = abi.decode(reason, (GetSwapQuoter));
    //         }
    //         else {
    //             revert("p");
    //         }
    //     }
    //     return (result.marginRequirement, tickBefore, result.tickAfter, result.fixedTokenDelta, result.variableTokenDelta, result.cumulativeFeeIncurred, result.fixedTokenDeltaUnbalanced);
    // }
}
