// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

library FixedAndVariableMath {
    uint256 public constant SECONDS_IN_YEAR = 31536000 * 10**18;
    
    
    function calculateSettlementCashflow(int256 fixedTokenBalance, int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, uint256 variableFactorToMaturity) public view returns(int256 cashflow) {
        
        PRBMath.SD59x18 memory fixedCashflow = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: fixedTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(fixedFactor(true, termStartTimestamp, termEndTimestamp))
            })
        );

        PRBMath.SD59x18 memory variableCashflow = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: variableTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(variableFactorToMaturity)
            })
        );

        cashflow = PRBMathSD59x18Typed.add(fixedCashflow, variableCashflow).value;
    
    }
    
    // todo: place in a separate library?
    function blockTimestampScaled() public view returns(uint256) {
        return uint256(block.timestamp) * 10**18;
    }
    
    // todo: scribble properties to test prb math
    /// #if_succeeds $result > 0;
    /// #if_succeeds old(timeInSeconds) > 0;
    function accrualFact(uint256 timeInSeconds)
        public
        pure
        returns (uint256 timeInYears) {
        
        timeInYears = PRBMathUD60x18Typed.div(
            PRBMath.UD60x18({
                value: timeInSeconds
            }),
            PRBMath.UD60x18({
                value: SECONDS_IN_YEAR
            })
        ).value;
    }


    /// #if_succeeds old(termStartTimestamp) < old(termEndTimestamp);
    /// #if_succeeds old(atMaturity) == true ==> timeInSeconds == termEndTimestamp - termStartTimestamp;
    function fixedFactor(
        bool atMaturity,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (uint256 fixedFactorValue) {

        // require(
        //     termEndTimestamp > termStartTimestamp,
        //     "E<=S"
        // );

        // require(
        //     blockTimestampScaled()  >= termStartTimestamp,
        //     "B.T>=S"
        // );

        // require(
        //     blockTimestampScaled()  <= termEndTimestamp,
        //     "B.T>=S"
        // );

        uint256 timeInSeconds;

        if (atMaturity) {
            timeInSeconds = PRBMathUD60x18Typed.sub(
                PRBMath.UD60x18({
                    value: termEndTimestamp
                }),
                PRBMath.UD60x18({
                    value: termStartTimestamp
                })
            ).value;
        } else {
            timeInSeconds = blockTimestampScaled() - termStartTimestamp;
        }

        uint256 timeInYears = accrualFact(timeInSeconds);

        fixedFactorValue = PRBMathUD60x18Typed
            .mul(
                PRBMath.UD60x18({value: timeInYears}),
                PRBMath.UD60x18({value: 10**16})
            )
            .value;
    }


    /// #if_succeeds old(termStartTimestamp) < old(termEndTimestamp);
    /// #if_succeeds excessBalance < 0 ==> fixedTokenBalance > amount0;
    /// #if_succeeds excessBalance > 0 ==> fixedTokenBalance < amount0;
    function calculateFixedTokenBalance(
        int256 amount0,
        int256 excessBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (int256 fixedTokenBalance) {

        require(
            termEndTimestamp > termStartTimestamp,
            "E<=S"
        );
     
        // expected fixed cashflow with unbalanced number of fixed tokens
        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(
            PRBMath.SD59x18({value: amount0}),
            PRBMath.SD59x18({
                value: int256(
                    fixedFactor(true, termStartTimestamp, termEndTimestamp)
                )
            })
        );

        // fixed cashflow  with balanced number of fixed tokens
        PRBMath.SD59x18 memory numerator = PRBMathSD59x18Typed.sub(
            exp1,
            PRBMath.SD59x18({value: excessBalance})
        );


        // fixed token balance that takes into account acrrued cashflows
        fixedTokenBalance = PRBMathSD59x18Typed
            .div(
                numerator,
                PRBMath.SD59x18({
                    value: int256(
                        fixedFactor(true, termStartTimestamp, termEndTimestamp)
                    )
                })
            )
            .value;
    }

    
    struct AccruedValues {
        int256 excessFixedAccruedBalance;
        int256 excessVariableAccruedBalance;
        int256 excessBalance;
    }
    


    function getExcessBalance(
        int256 amount0,
        int256 amount1,
        uint256 accruedVariableFactor,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp) internal view returns (int256) {

        AccruedValues memory accruedValues;

        accruedValues.excessFixedAccruedBalance = PRBMathSD59x18Typed.mul(
                PRBMath.SD59x18({value: amount0}),
                PRBMath.SD59x18({
                    value: int256(
                        fixedFactor(
                            false,
                            termStartTimestamp,
                            termEndTimestamp
                        )
                    )
                })
        ).value;

        accruedValues.excessVariableAccruedBalance = PRBMathSD59x18Typed.mul(
                PRBMath.SD59x18({value: amount1}),
                PRBMath.SD59x18({value: int256(accruedVariableFactor)})
        ).value;

        accruedValues.excessBalance = PRBMathSD59x18Typed.add(
                PRBMath.SD59x18({value: accruedValues.excessFixedAccruedBalance}),
                PRBMath.SD59x18({value: accruedValues.excessVariableAccruedBalance})
        ).value;

        return accruedValues.excessBalance;

    }
    
    

    /// #if_succeeds termEndTimestamp > termStartTimestamp;
    function getFixedTokenBalance(
        int256 amount0,
        int256 amount1,
        uint256 accruedVariableFactor,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (int256 fixedTokenBalance) {

        // todo: check that amount0 and amount1 are of different signs? (scribble?)
        
        // require(
        //     termEndTimestamp > termStartTimestamp,
        //     "E<=S"
        // );

        int256 excessBalance = getExcessBalance(amount0, amount1, accruedVariableFactor, termStartTimestamp, termEndTimestamp);
        
        fixedTokenBalance = calculateFixedTokenBalance(
            amount0,
            excessBalance,
            termStartTimestamp,
            termEndTimestamp
        );

    }
    
}
