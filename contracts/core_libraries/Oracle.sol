// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";


library Oracle {

    struct Observation {
        // the block timestamp of the observation
        uint256 blockTimestamp; // todo: uint32 so that it fits into a single slot
        // the logApy accumulator, i.e. logApy * time elapsed since the rate oracle was first initialized 
        // todo: geometric vs arithmetic twap gas + utility considerations
        uint256 logApyCumulative;
        // whether or not the observation is initialized
        bool initialized;
    }

    function grow(
        Observation[65535] storage self,
        uint16 current,
        uint16 next
    ) internal returns (uint16) {
        require(current > 0, "I");

        // no-op if the passed next value isn't greater than the current next value
        if (next <= current) return current;

        // store in each slot to prevent fresh SSTOREs in swaps 
        // this data will not be used because the initialized boolean is still false
        for (uint16 i = current; i < next; i++) self[i].blockTimestamp = 1; // todo: figure out what this does

        return next;

    }


    
    /// @notice Initialize the oracle array by writing the first slot. Called once for the lifecycle of the observations array
    /// @param self The stored oracle array
    /// @param time The time of the oracle initialization, via block.timestamp truncated to uint32
    /// @return cardinality The number of populated elements in the oracle array
    /// @return cardinalityNext The new length of the oracle array, independent of population
    function initialize(Observation[65535] storage self, uint32 time) internal returns (uint16 cardinality, uint16 cardinalityNext) {
        self[0] = Observation({
            blockTimestamp: time,
            logApyCumulative: 0,
            initialized: true
        });

        return(1,1);
    }


    /// @notice Writes an oracle observation to the array
    /// @dev Writable at most once per block. Index represents the most recently written element. cardinality and index must be tracked externally.
    /// If the index is at the end of the allowable array length (according to cardinality), and the next cardinality
    /// is greater than the current one, cardinality may be increased. This restriction is created to preserve ordering.
    /// @param self The stored oracle array
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param blockTimestamp The timestamp of the new observation
    /// @param logApy The active logApy at the time of the new observation
    /// @param cardinality The number of populated elements in the oracle array
    /// @param cardinalityNext The new length of the oracle array, independent of population
    /// @return indexUpdated The new index of the most recently written element in the oracle array
    /// @return cardinalityUpdated The new cardinality of the oracle array
    function write(
        Observation[65535] storage self,
        uint16 index,
        uint256 blockTimestamp,
        uint256 logApy,
        uint16 cardinality,
        uint16 cardinalityNext
    ) internal returns (uint16 indexUpdated, uint16 cardinalityUpdated) {

        Observation memory last = self[index];

        // early return if we've already written an observation this block
        if (last.blockTimestamp == blockTimestamp) return (index, cardinality);

        // if the conditions are right, we can bump the cardinality
        if (cardinalityNext > cardinality && index == (cardinality - 1)) {
            cardinalityUpdated = cardinalityNext;
        } else {
            cardinalityUpdated = cardinality;
        }

        indexUpdated = (index + 1) % cardinalityUpdated; // todo: why?, because of buffer recycling?

        self[indexUpdated] = transform(last, blockTimestamp, logApy);

    }

    
    /// @notice comparator for 32-bit timestamps (understand better)

    

    /// @notice Transforms a previous observation into a new observation, given the passage of time and the current logApy value for the RateOracleAPY
    /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
    /// @param last The specified observation to be transformed
    /// @param blockTimestamp The timestamp of the new observation
    /// @param logApy The logApy of of the APY of the underlying RateOracle
    /// @return Observation The newly populated observation
    function transform(
        Observation memory last,
        uint256 blockTimestamp,
        uint256 logApy
    ) private pure returns (Observation memory) {
        
        PRBMath.UD60x18 memory delta = PRBMathUD60x18Typed.sub(
            PRBMath.UD60x18({
                value: uint256(blockTimestamp)
            }),

            PRBMath.UD60x18({
                value: uint256(last.blockTimestamp)
            }) 
        );

        uint256 logApyCumulativeNew = PRBMathUD60x18Typed.add(
            
            PRBMathUD60x18Typed.mul(
                PRBMath.UD60x18({
                    value:  uint256(logApy)
                }),

                delta
            ),

            PRBMath.UD60x18({
                value: last.logApyCumulative
            }) 
        ).value;


        return
            Observation({
                blockTimestamp: blockTimestamp,
                logApyCumulative: logApyCumulativeNew,
                initialized: true
            });

    }
    
    /// @notice Fetches the observations beforeOrAt and atOrAfter a given target, i.e. where [beforeOrAt, atOrAfter] is satisfied
    /// @dev Assumes there is at least 1 initialized observation.
    /// Used by observeSingle() to compute the counterfactual accumulator values as of a given block timestamp.
    /// @param self The stored oracle array
    /// @param target The timestamp at which the reserved observation should be for
    /// @param logApy logApy
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param cardinality The number of populated elements in the oracle array
    /// @return beforeOrAt The observation which occurred at, or before, the given timestamp
    /// @return atOrAfter The observation which occurred at, or after, the given timestamp
    function getSurroundingObservarions(
        Observation[65535] storage self,
        uint256 target,
        uint256 logApy,
        uint16 index,
        uint16 cardinality
    ) private view returns (Observation memory beforeOrAt, Observation memory atOrAfter) {

        // optimistically set before to the newest observation
        beforeOrAt = self[index];

        if (beforeOrAt.blockTimestamp <= target) {
            if (beforeOrAt.blockTimestamp == target) {
                // if the newest observation eqauls target, we are in the same block, so we can ignore atOrAfter
                return (beforeOrAt, atOrAfter);
            } else {
                // otherwise, we need to transform
                return (beforeOrAt, transform(beforeOrAt, target, logApy));
            }
        }

        // set to the oldest observation
        beforeOrAt = self[(index + 1) % cardinality];
        if (!beforeOrAt.initialized) beforeOrAt = self[0];

        require(beforeOrAt.blockTimestamp <= target, "OLD");

        // if we've reached this point, we have to binary search
        return binarySearch(self, target, index, cardinality);

    }


    function binarySearch(
        Observation[65535] storage self,
        uint256 target,
        uint16 index,
        uint16 cardinality
    ) private view returns (Observation memory beforeOrAt, Observation memory atOrAfter) {
        uint256 l = (index + 1) % cardinality; // oldest observation
        uint256 r = l + cardinality - 1; // newest observation
        uint256 i;
        while (true) {
            i = (l + r) / 2;

            beforeOrAt = self[i % cardinality];

            // we've landed on an uninitialized tick, keep searching higher (more recently)
            if (!beforeOrAt.initialized) {
                l = i + 1;
                continue;
            }

            atOrAfter = self[(i + 1) % cardinality];

            bool targetAtOrAfter = beforeOrAt.blockTimestamp <= target; //lte(time, beforeOrAt.blockTimestamp, target);
        
            // check if we've found the answer!
            if (targetAtOrAfter && target <= atOrAfter.blockTimestamp) break;

            if (!targetAtOrAfter) r = i - 1;
            else l = i + 1;
        }
    }


    /// @dev Reverts if an observation at or before the desired observation timestamp does not exist.
    /// 0 may be passed as `secondsAgo' to return the current cumulative values.
    /// If called with a timestamp falling between two observations, returns the counterfactual accumulator values
    /// at exactly the timestamp between the two observations.
    /// @param self The stored oracle array
    /// @param time The current block timestamp
    /// @param secondsAgo The amount of time to look back, in seconds, at which point to return an observation
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param cardinality The number of populated elements in the oracle array
    /// @return logApyCumulative The logApy * time elapsed since the pool was first initialized, as of `secondsAgo`
    function observeSingle(
        Observation[65535] storage self,
        uint256 time,
        uint256 secondsAgo,
        uint256 logApy,
        uint16 index,
        uint16 cardinality
    ) internal view returns (uint256 logApyCumulative) {

        if (secondsAgo == 0) {
            Observation memory last = self[index];
            if (last.blockTimestamp != time) last = transform(last, time, logApy);
        }

        uint256 target = PRBMathUD60x18Typed.sub(

            PRBMath.UD60x18({
                value: time
            }),

            PRBMath.UD60x18({
                value: secondsAgo
            })
        ).value;

        (Observation memory beforeOrAt, Observation memory atOrAfter) = getSurroundingObservarions(self, target, logApy, index, cardinality);

        if (target == beforeOrAt.blockTimestamp) {
            // we are at the left boundary
            return (beforeOrAt.logApyCumulative);
        } else if (target == atOrAfter.blockTimestamp) {
            // we are at the right boundary
            return (atOrAfter.logApyCumulative);
        } else {
            // we are in the middle
            uint256 observationTimeDelta = PRBMathUD60x18Typed.sub(

                PRBMath.UD60x18({
                    value: atOrAfter.blockTimestamp
                }),

                PRBMath.UD60x18({
                    value: beforeOrAt.blockTimestamp
                })
            ).value;

            uint256 targetDelta = PRBMathUD60x18Typed.sub(

                PRBMath.UD60x18({
                    value: target
                }),

                PRBMath.UD60x18({
                    value: beforeOrAt.blockTimestamp
                })
            ).value;

            PRBMath.UD60x18 memory cumulativeLogApyDifferenceScaled = PRBMathUD60x18Typed.div(

                PRBMathUD60x18Typed.sub(

                    PRBMath.UD60x18({
                        value: atOrAfter.logApyCumulative
                    }),

                    PRBMath.UD60x18({
                        value: beforeOrAt.logApyCumulative
                    })

                ),

                PRBMath.UD60x18({
                    value: uint256(observationTimeDelta)
                })

            );

            logApyCumulative = PRBMathUD60x18Typed.add(

                PRBMathUD60x18Typed.mul(

                    cumulativeLogApyDifferenceScaled,

                    PRBMath.UD60x18({
                        value: uint256(targetDelta)
                    })

                ),

                PRBMath.UD60x18({
                    value: beforeOrAt.logApyCumulative
                })

            ).value;

        }

    }


    // todo: function observe


}
