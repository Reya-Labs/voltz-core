// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRateOracle {
    
    // todo either delete this and usee the TWAP everywhere, or move this struct defn to IAaveRateOracle so we can document it using Aave terminology
    struct Rate {
        bool isSet; // todo: remove cos non-zero timestamp is sufficient
        uint256 timestamp; /// In wei-seconds
        uint256 rateValue; /// in Ray. A return value of 1e27 (1 Ray) indicates no income since pool creation. A value of 2e27 indicates a 100% yield since pool creation. Etc.
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

    /// @notice Calculates the observed APY returned by the underlying in a given period
    /// @param underlying The address of an underlying ERC20 token known to this Oracle (e.g. USDC not aaveUSDC)
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) external returns(uint256);

    // function getApyFromTo(
    //     address underlying,
    //     uint256 from,
    //     uint256 to
    // )  view returns (uint256 apyFromTo);

    function writeOrcleEntry(address underlying) external;

}
