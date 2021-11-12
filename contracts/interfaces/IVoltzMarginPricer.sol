pragma solidity ^0.8.0;

interface IVoltzMarginPricer {
    function getConfidenceBound(bool isLower) external view returns (uint256);

    // function getHistoricalPrice(uint80 _roundId) external view returns (uint256, uint256);
}
