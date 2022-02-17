pragma solidity ^0.8.0;

pragma abicoder v2;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../utils/TickMath.sol";
import "./peripheral_libraries/LiquidityAmounts.sol";

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
    function mintOrBurn(MintOrBurnParams memory params) external {
        // require the recepient to be the message sender

        IVAMM vamm = getVAMM(params.marginEngineAddress);

        // compute the liquidity amount for the amount of notional (amount1) specified

        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(params.tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(params.tickUpper);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
            sqrtRatioAX96,
            sqrtRatioBX96,
            params.notional
        );

        if (params.isMint) {
            vamm.mint(
                params.recipient,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        } else {
            // invoke a burn
            vamm.burn(
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
        bool isTrader;
        int24 tickLower;
        int24 tickUpper;
    }

    function swap(SwapPeripheryParams memory params) external {
        // require the recepient to be the message sender

        IVAMM vamm = getVAMM(params.marginEngineAddress);

        int256 amountSpecified;

        if (params.isFT) {
            amountSpecified = int256(params.notional);
        } else {
            amountSpecified = -int256(params.notional);
        }

        // what if tick lower and tick upper are zero

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
            isExternal: false,
            tickLower: params.tickLower == 0 ? -tickSpacing : params.tickLower,
            tickUpper: params.tickUpper == 0 ? tickSpacing : params.tickUpper
        });

        vamm.swap(swapParams);
    }
}
