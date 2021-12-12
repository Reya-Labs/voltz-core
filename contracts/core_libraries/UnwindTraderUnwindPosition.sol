// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IAMM.sol";
import "../interfaces/IVAMM.sol";
import "../utils/TickMath.sol";
import "../core_libraries/Position.sol";
import "../core_libraries/Tick.sol";

library UnwindTraderUnwindPosition {
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;


    function unwindTrader(
        address ammAddress, // not: different from the vAMM
        address traderAddress,
        int256 notional
    ) external {
        
        IAMM amm = IAMM(ammAddress);

        bool isFT = notional > 0;

        if (isFT) {
            // get into a VT swap
            // notional is positive
            IVAMM.SwapParams memory params = IVAMM.SwapParams({
               recipient: traderAddress,
               isFT: !isFT,
               amountSpecified: -notional,
               sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
               // todo: the last three need to be double checked
               isUnwind: true,
               isTrader: true
            });

            amm.swap(params);

        } else {
            // get into an FT swap
            // notional is negative
            
            IVAMM.SwapParams memory params = IVAMM.SwapParams({
               recipient: traderAddress,
               isFT: isFT,
               amountSpecified: notional,
               sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
               isUnwind: true,
               isTrader: true
            });

            amm.swap(params);

        }
    }


    function unwindPosition(
        address ammAddress,
        address owner,
        int24 tickLower,
        int24 tickUpper,
        Position.Info memory position
    ) external returns(int256 _fixedTokenBalance, int256 _variableTokenBalance) {

        IAMM amm = IAMM(ammAddress);

        Tick.checkTicks(tickLower, tickUpper); 
        require(position.variableTokenBalance!=0, "no need to unwind a net zero position");
        
        // todo: before checking the variable or fixed token balances, we need to make sure they have been updated (check lastTimestamp)
        // initiate a swap
        bool isFT = position.fixedTokenBalance > 0;

        if (isFT) {
            // get into a VT swap
            // variableTokenBalance is negative

            IVAMM.SwapParams memory params = IVAMM.SwapParams({
               recipient: owner,
               isFT: !isFT,
               amountSpecified: position.variableTokenBalance, // todo: double check the sign 
               sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
               isUnwind: true,
               isTrader: false
            });

            (_fixedTokenBalance, _variableTokenBalance) = amm.swap(params); // todo: check the outputs are correct

        } else {
            // get into an FT swap
            // variableTokenBalance is positive
            
            IVAMM.SwapParams memory params = IVAMM.SwapParams({
               recipient: owner,
               isFT: isFT,
               amountSpecified: position.variableTokenBalance,
               sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
               isUnwind: true,
               isTrader: false
            });

            (_fixedTokenBalance, _variableTokenBalance) = amm.swap(params); 

        }    

    }

}