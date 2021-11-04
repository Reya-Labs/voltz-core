pragma solidity ^0.8.0;
// import {ILendingPool} from "@aave/protocol-v2/contracts/interfaces/ILendingPool.sol";
import "./underlyingPool/IAaveLendingPool.sol";


interface IAaveRateOracle {

    // IAaveLendingPool lendingPool;
    // mapping(address => mapping(uint256 => Rate)) public rates;
    // address constant aaveLendingPoolAddress = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9; // mainnet

    struct Rate {
        bool isSet;
        uint256 timestamp;
        uint256 rateValue;
    }

    function rates(address underlying, uint256 stamp) external returns(bool isSet, uint256 timestamp, uint256 rateValue);

    function lendingPool() external returns(IAaveLendingPool);

    function updateRate(address underlying) external;

    function getRateAtTimestamp(address underlying, uint256 timestamp) external returns (uint256);

    function getRateFromTo(address underlying, uint256 from, uint256 to) external returns (uint256);

}