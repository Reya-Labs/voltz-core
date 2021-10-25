pragma solidity ^0.8.0;
import "../MarginCalculator.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";



contract MarginCalculatorTest {


    function tickRangeNotionalFixedRate(uint160 sqrtRatioLower, uint160 sqrtRatioUpper, uint128 liquidity) public pure returns (uint256 notional, uint256 fixedRate) {

        uint256 amount0 = SqrtPriceMath.getAmount0Delta(sqrtRatioLower, sqrtRatioUpper, liquidity, true); // roundup is set to true
        uint256 amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioLower, sqrtRatioUpper, liquidity, true); // roundup is set to true

        PRBMath.UD60x18 memory amount0UD = PRBMath.UD60x18({ value: amount0 });
        PRBMath.UD60x18 memory amount1UD = PRBMath.UD60x18({ value: amount1 });

        PRBMath.UD60x18 memory notionalUD = amount1UD;

        PRBMath.UD60x18 memory onePercent = PRBMath.UD60x18({ value: 10**16 });

        PRBMath.UD60x18 memory fixedRateUD =  PRBMathUD60x18Typed.mul(PRBMathUD60x18Typed.div(amount0UD, amount1UD), onePercent);

        notional = notionalUD.value;
        fixedRate = fixedRateUD.value;

    }

}