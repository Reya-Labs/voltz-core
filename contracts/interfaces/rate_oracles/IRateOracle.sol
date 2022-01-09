// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


// @audit High-level comment - there are some functions here that perhaps do not need to be part ofthe interface because we only expect to use them internally. This doesn't mean that we hide the functions (it's generally good to make functions public where it's safe to do so), but a smaller interface containing only the functions that callers will need may be better.

/// @dev The RateOracle is used for two purposes on the Voltz Protocol
/// @dev Settlement: in order to be able to settle IRS positions after the termEndTimestamp of a given AMM
/// @dev Margin Engine Computations: getHistoricalApy of the Rate Oracle is a quantity used in the MarginCalculator
/// @dev It is necessary to produce margin requirements for Trader and Liquidity Providers
interface IRateOracle {
    
    // events
    
    /// @notice Emitted by the rate oracle for increases to the number of observations that can be stored
    /// @param observationCardinalityNextOld The previous value of the next observation cardinality
    /// @param observationCardinalityNextNew The updated value of the next observation cardinality
    event IncreaserateCardinalityNext(
        uint16 observationCardinalityNextOld,
        uint16 observationCardinalityNextNew
    );

    // structs

    struct Rate { // @audit - move into IAaveRateOracle if this is just an implementation detail that can differ for different oracles (but it might not be - see the rates function)
    // @audit - this struct uses two storage slots rather than one - we could perhaps halve the gas cost by compressing it down to 1, by storing the timestamp in seconds (not secondsWad) as a uint32, and a bool for initialized (to front-load gas costs of adding new Rates to our array) and a uint216 for rateValue. (If we go this route we should also understand the uniswap Oracle's `lte` function and decide whetehr we need it)
        /// @dev The block timestamp of an observed rate value in wei seconds
        uint256 timestamp; // @audit suffix Wad if unchanged
        /// @dev In case of Aave the rate value is in Ray
        /// @dev The rate value is obtained by calling IAaveV2LendingPool(aaveLendingPool).getReserveNormalizedIncome(underlying); // @audit - may be pragmatic to leave this here, but ideally this semantics description should probably move to the aaveRateOracle or its interface
        /// @dev where aaveLendingPool is the address of the Aave Lending Pool contract and underlying is the underlying token of the Rate Oracle
        uint256 rateValue; // @audit suffix Ray if unchanged

    }

    struct OracleVars {
        
        /// @dev the most-recently updated index of the rates array
        uint16 rateIndex;

        /// @dev the current maximum number of rates that are being stored
        uint16 rateCardinality;

        /// @dev the next maximum number of rates to store, triggered in rates.write 
        uint16 rateCardinalityNext;

    }


    // view functions

    /**
    * @notice Gets the bytes32 ID of the rate oracle
    * @dev Should be unique for a given underlying protocol and underlying token pair (e.g. Aave v2 USDC)
    * @return Returns the rate oracle and protocol identifier.
    **/
    function rateOracleId() external view returns (bytes32); // @audit remove; can just use address as identifier
    
    /// @notice Gets the unique look-back window necessary to calculate the historical APY of the Rate Oracle
    /// @dev The historical APY of the Rate Oracle is necessary for MarginEngine computations
    /// @dev The look-back window is seconds in wei from the current timestamp in wei
    /// @dev This value is only settable by the the Factory owner and should be unique for each RateOracle
    /// @dev When setting secondAgo, the setter needs to take into consideration the underlying volatility of the APYs in the reference yield-bearing pool (e.g. Aave v2 USDC)
    /// @return secondsAgo in wei seconds
    function secondsAgo() external view returns (uint256); // @audit suffix with Wad, and move this to MarginEngine so that it can be different for different IRS durations
    
    /// @notice Gets minimum number of seconds in wei that need to pass since the last update to the rates array 
    /// @dev This is a throttling mechanic that needs to ensure we don't run out of space in the rates array
    /// @dev The maximum size of the rates array is 65535 entries
    // AB: as long as this doesn't affect the termEndTimestamp rateValue too much
    // AB: can have a different minSecondsSinceLastUpdate close to termEndTimestamp to have more granularity for settlement purposes
    /// @return minSecondsSinceLastUpdate in wei seconds
    function minSecondsSinceLastUpdate() external view returns (uint256); // @audit: suffix with Wad

    /// @notice Gets the address of the underlying token of the RateOracle
    /// @return underlying The address of the underlying token
    function underlying() external view returns (address);

    /// @notice Gets the address of the top-level Factory contract
    /// @return Factory Address of the Factory contract
    function factory() external view returns (address);

    /// @notice Gets the timestamp and the rate value given an index that references a specific rate in the rates array
    /// @return timestamp The block timestamp of an observed rate value in wei seconds
    /// @return rateValue The rate value
    /// @dev In case of Aave the rate value is in Ray
    /// @dev The rate value is obtained by calling IAaveV2LendingPool(aaveLendingPool).getReserveNormalizedIncome(underlying);
    /// @dev where aaveLendingPool is the address of the Aave Lending Pool contract and underlying is the underlying token of the Rate Oracle
    function rates(uint256 index) external view returns( // @audit do we need this in the interface? Fine for the Aave implementation to expose it, but arguably it's implementation detail and could just come out of the interface unless we expect third parties to use it? If keeping, we should consider returning a Rate struct and adding suffixes
        uint256 timestamp,
        uint256 rateValue
    );


    /// @notice Gets the current rateIndex, rateCardinality and rateCardinalityNext of the RateOracle
    /// @return rateIndex The most-recently updated index of the rates array
    /// @return rateCardinality The current maximum number of rates that are being stored // @audit - is this right? it's used as the second param in calls to writeRate, where the description sounds different 
    /// @return rateCardinalityNext The next maximum number of rates to store, triggered in rates.write 
    function oracleVars() external view returns (     // @audit again, does this need to be part of the interface or is it just implementation detail (can still be public even if implementation detail). If in the interface, should consider returning an OracleVars struct.
        uint16 rateIndex,
        uint16 rateCardinality,
        uint16 rateCardinalityNext
    );

    /// @notice Gets the variable factor @audit - we should describe twhat this means
    /// @return result The variable factor
    /// @dev If the current block timestamp is beyond the maturity of the AMM, then the variableFactor is getRateFromTo(termStartTimestamp, termEndTimestamp);
    /// @dev If the current block timestamp is before the maturity of the AMM, then the variableFactor is getRateFromTo(termStartTimestamp,Time.blockTimestampScaled());
    // @audit - a little odd to have termEndTimestamp silently ignored in the latter case? Don't callers then need to know whether or not the AMM has matured when calling this, so that they understand the semantics? If so, is it better to have two separate functions, or maybe just delete this and use getRateFromTo directly?
    /// AB: Can place the logic in the BaseRateOracle
    function variableFactor(uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns(uint256 result);

    // non-view functions
    
    /// @notice Sets secondsAgo: The unique look-back window necessary to calculate the historical APY of the Rate Oracle
    /// @dev Can only be set by the Factory Owner
    function setSecondsAgo(uint256 _secondsAgo) external; // @audit suffix with Wad if semantics unchanged. But move this to MarginEngine so that it can be different for different IRS durations.

    /// @notice Sets minSecondsSinceLastUpdate: The minimum number of seconds in wei that need to pass since the last update to the rates array 
    /// @dev Can only be set by the Factory Owner
    function setMinSecondsSinceLastUpdate(uint256 _minSecondsSinceLastUpdate) external; // @audit suffix param with Wad

    /// @notice Increase the maximum number of rates observations that this RateOracle will store
    /// @dev This method is no-op if the RateOracle already has an observationCardinalityNext greater than or equal to
    /// the input observationCardinalityNext.
    /// @param rateCardinalityNext The desired minimum number of observations for the pool to store
    function increaseObservarionCardinalityNext(uint16 rateCardinalityNext) external;

    /// @notice Writes a rate observation to the array
    /// @dev Writable at most once per block. Index represents the most recently written element in the rates array.
    /// If the index is at the end of the allowable array length (according to cardinality), and the next cardinality
    /// is greater than the current one, cardinality may be increased. This restriction is created to preserve ordering.
    /// WriteRate should only be called via writeOracleEntry
    /// Write oracle entry is called whenever a new position is minted via the vamm or when a swap is initiated via the vamm
    /// That way the gas costs of Rate Oracle updates can be distributed across organic interactions with the protocol
    /// If less than minSecondsSinceLastUpdate (in wei) have passed since the last update to the rate array, the transaction will be reverted
    /// @param index The index of the rate that was most recently written to the rates array
    /// @param cardinality The number of populated elements in the oracle array
    /// @param cardinalityNext The new length of the oracle array, independent of population
    /// @return indexUpdated The new index of the most recently written element in the oracle array
    /// @return cardinalityUpdated The new cardinality of the oracle array
    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    ) external returns (uint16 indexUpdated, uint16 cardinalityUpdated);

    /// @dev Reverts if a rate at or before the desired observation timestamp does not exist.
    /// If called with a timestamp falling between two observations, returns the counterfactual rate value
    /// at exactly the timestamp between the two observations.
    /// @param currentTime The current block timestamp in wei seconds
    /// @param queriedTime The block timestamp in wei seconds for which we wish to retrive a rateValue
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param cardinality The number of populated elements in the rates array
    /// @return rateValue 
    /// @dev In case of Aave the rate value is in Ray
    /// @dev The rate value is obtained by calling IAaveV2LendingPool(aaveLendingPool).getReserveNormalizedIncome(underlying);
    /// @dev where aaveLendingPool is the address of the Aave Lending Pool contract and underlying is the underlying token of the Rate Oracle
    function observeSingle(
        uint256 currentTime, // @audit don't fully understand why we need this as a param. See comments on same param in implementation.
        uint256 queriedTime,
        uint16 index,
        uint16 cardinality
    ) external view returns(uint256 rateValue);

    /// @notice Writes a rate observation to the rates array given the current rate cardinality, rate index and rate cardinality next
    /// Write oracle entry is called whenever a new position is minted via the vamm or when a swap is initiated via the vamm
    /// That way the gas costs of Rate Oracle updates can be distributed across organic interactions with the protocol
    function writeOracleEntry() external;

    /// @notice Computes the historical apy value of the RateOracle
    /// @dev The lookback window used by this function is determined by the secondsAgo (in wei seconds) state variable of the RateOracle
    function getHistoricalApy() external view returns (uint256 historicalApy); // @audit if secondsAgo moves into the MarginEngine then this function and its implementation are probably both superflous

    /// @notice Initialize the rate array by writing the first slot. Called once for the lifecycle of the rates array
    function initialize() external; 

}
