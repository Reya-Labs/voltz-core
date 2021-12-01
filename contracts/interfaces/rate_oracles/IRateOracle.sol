pragma solidity ^0.8.0;

interface IRateOracle {
    
    struct Rate {
        bool isSet;
        uint256 timestamp;
        uint256 rateValue;
    }

     /**
     * @notice Gets the bytes32 ID of the rate oracle.
     * @return Returns the rate oracle and protocol identifier.
     **/
    function rateOracleId() external view returns (bytes32);

    function secondsAgo() external view returns (uint256);

    function setSecondsAgo(uint256 _secondsAgo) external;

    function getTwapApy(address underlying) external view returns (uint256 twapApy);

    // function rates(address underlying, uint256 stamp)
    //     external
    //     returns (
    //         bool isSet,
    //         uint256 timestamp,
    //         uint256 rateValue
    //     );

    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) external returns(uint256);

    // function getApyFromTo(
    //     address underlying,
    //     uint256 from,
    //     uint256 to
    // )  view returns (uint256 apyFromTo);

    function writeOrcleEntry(address underlying) external;

}
