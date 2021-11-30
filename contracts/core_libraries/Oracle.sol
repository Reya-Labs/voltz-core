pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathSD59x18Typed.sol";



library Oracle {

    struct Observation {
        // the block timestamp of the observation
        uint256 blockTimestamp; // todo: uint32 so that it fits into a single slot
        // the logApy accumulator, i.e. logApy * time elapsed since the rate oracle was first initialized 
        // todo: geometric vs arithmetic twap gas + utility considerations
        int256 logApyCumulative;
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
        
        PRBMath.SD59x18 memory delta = PRBMathSD59x18Typed.sub(
            PRBMath.SD59x18({
                value: int256(blockTimestamp)
            }),

            PRBMath.SD59x18({
                value: int256(last.blockTimestamp)
            }) 
        );

        int256 logApyCumulativeNew = PRBMathSD59x18Typed.add(
            
            PRBMathSD59x18Typed.mul(
                PRBMath.SD59x18({
                    value:  int256(logApy)
                }),

                delta
            ),

            PRBMath.SD59x18({
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


}