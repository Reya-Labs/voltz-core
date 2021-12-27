// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRateOracle {
    
    // structs
    struct Rate {
        uint256 timestamp; /// In wei-seconds
        uint256 rateValue; // In wei
    }

    struct OracleVars {
        
        // the most-recently updated index of the rates array
        uint16 rateIndex;

        // the current maximum number of rates that are being stored
        uint16 rateCardinality;

        // the next maximum number of rates to store, triggered in rates.write 
        uint16 rateCardinalityNext;

    }

    // view functions

    /**
    * @notice Gets the bytes32 ID of the rate oracle.
    * @return Returns the rate oracle and protocol identifier.
    **/
    function rateOracleId() external view returns (bytes32);

    function secondsAgo() external view returns (uint256);

    function underlying() external view returns (address);


    // non-view functions

    function setSecondsAgo(uint256 _secondsAgo) external;

    function variableFactor(bool atMaturity, uint256 termStartTimestamp, uint256 termEndTimestamp) external returns(uint256 result);

    function increaseObservarionCardinalityNext(uint16 rateCardinalityNext) external;

    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    ) external returns (uint16 indexUpdated, uint16 cardinalityUpdated);

    function observeSingle(
        uint256 currentTime,
        uint256 queriedTime,
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    ) external returns(uint256 rateValue);

    function writeOracleEntry() external;

    function getHistoricalApy() external returns (uint256 historicalApy);

}
