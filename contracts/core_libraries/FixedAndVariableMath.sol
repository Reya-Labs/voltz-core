pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

library FixedAndVariableMath {
    uint256 public constant SECONDS_IN_YEAR = 31536000 * 10**18;

    // todo: make the function internal
    function accrualFact(uint256 timePeriodInSeconds)
        public
        pure
        returns (uint256 timePeriodInYears)
    {
        PRBMath.UD60x18 memory xUD = PRBMath.UD60x18({
            value: timePeriodInSeconds
        });
        PRBMath.UD60x18 memory yUD = PRBMath.UD60x18({value: SECONDS_IN_YEAR});

        timePeriodInYears = PRBMathUD60x18Typed.div(xUD, yUD).value;
    }

    function fixedFactor(
        bool atMaturity,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (uint256) {
        // todo: always at maturity
        uint256 timePeriodInSeconds;

        if (atMaturity) {
            timePeriodInSeconds = termEndTimestamp - termStartTimestamp;
        } else {
            timePeriodInSeconds = block.timestamp - termStartTimestamp;
        }

        uint256 timePeriodInYears = accrualFact(timePeriodInSeconds);

        uint256 fixedFactorValue = PRBMathUD60x18Typed
            .mul(
                PRBMath.UD60x18({value: timePeriodInYears}),
                PRBMath.UD60x18({value: 10**16})
            )
            .value;

        return fixedFactorValue;
    }

    function calculateFixedTokenBalance(
        int256 amount0,
        int256 excessBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (int256 fixedTokenBalance) {
        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(
            PRBMath.SD59x18({value: amount0}),
            PRBMath.SD59x18({
                value: int256(
                    fixedFactor(true, termStartTimestamp, termEndTimestamp)
                )
            })
        );

        PRBMath.SD59x18 memory numerator = PRBMathSD59x18Typed.sub(
            exp1,
            PRBMath.SD59x18({value: excessBalance})
        );

        fixedTokenBalance = PRBMathSD59x18Typed
            .div(
                exp1,
                PRBMath.SD59x18({
                    value: int256(
                        fixedFactor(true, termStartTimestamp, termEndTimestamp)
                    )
                })
            )
            .value;
    }

    function getFixedTokenBalance(
        uint256 amount0,
        uint256 amount1,
        int256 accruedVariableFactor,
        bool isFT,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) internal view returns (int256 fixedTokenBalance) {
        int256 excessFixedAccruedBalance;
        int256 excessVariableAccruedBalance;
        int256 excessBalance;

        if (isFT) {
            PRBMath.SD59x18
                memory excessFixedAccruedBalance = PRBMathSD59x18Typed.mul(
                    PRBMath.SD59x18({value: int256(amount0)}),
                    PRBMath.SD59x18({
                        value: int256(
                            fixedFactor(
                                false,
                                termStartTimestamp,
                                termEndTimestamp
                            )
                        )
                    })
                );

            PRBMath.SD59x18
                memory excessVariableAccruedBalance = PRBMathSD59x18Typed.mul(
                    PRBMath.SD59x18({value: -int256(amount1)}),
                    PRBMath.SD59x18({value: accruedVariableFactor})
                );

            excessBalance = PRBMathSD59x18Typed
                .add(excessFixedAccruedBalance, excessVariableAccruedBalance)
                .value;

            fixedTokenBalance = calculateFixedTokenBalance(
                int256(amount0),
                excessBalance,
                termStartTimestamp,
                termEndTimestamp
            );
        } else {
            PRBMath.SD59x18
                memory excessFixedAccruedBalance = PRBMathSD59x18Typed.mul(
                    PRBMath.SD59x18({value: -int256(amount0)}),
                    PRBMath.SD59x18({
                        value: int256(
                            fixedFactor(
                                false,
                                termStartTimestamp,
                                termEndTimestamp
                            )
                        )
                    })
                );

            PRBMath.SD59x18
                memory excessVariableAccruedBalance = PRBMathSD59x18Typed.mul(
                    PRBMath.SD59x18({value: int256(amount1)}),
                    PRBMath.SD59x18({value: accruedVariableFactor})
                );

            excessBalance = PRBMathSD59x18Typed
                .add(excessFixedAccruedBalance, excessVariableAccruedBalance)
                .value;

            fixedTokenBalance = calculateFixedTokenBalance(
                -int256(amount0),
                excessBalance,
                termStartTimestamp,
                termEndTimestamp
            );
        }
    }
}
