// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRateOracle {

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

    // todo: is atMaturity superflous here cos we could just set termEndTimestamp to zero?
    /// @notice Calculates the interest returned by the variable rate asset in a given period
    /// @param atMaturity Whether to use termEndTimestamp instead of the current time as the period end
    /// @param underlyingToken The address of an underlying ERC20 token known to this Oracle (e.g. USDC not aaveUSDC)
    /// @param termStartTimestamp The timestamp of the start of the period, in wei-seconds
    /// @param termEndTimestamp The timestamp of the end of the period, in wei-seconds
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) external returns(uint256);

    // function getApyFromTo(
    //     address underlying,
    //     uint256 from,
    //     uint256 to
    // )  view returns (uint256 apyFromTo);

    function writeOrcleEntry(address underlying) external;

}
