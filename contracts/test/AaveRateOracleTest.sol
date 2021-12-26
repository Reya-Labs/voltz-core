// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import "../rate_oracles/AaveRateOracle.sol";
// import "../core_libraries/FixedAndVariableMath.sol";

// contract AaveRateOracleTest is AaveRateOracle {

//     uint256 public mostRecentVariableFactor;

//     Rate public startRate;
//     Rate public endRate;

//     function variableFactorTest(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public returns(uint256 result) {
//         mostRecentVariableFactor = variableFactor(atMaturity, underlyingToken, termStartTimestamp, termEndTimestamp);
//     }

//     // function getReserveNormalizedIncome(address underlying) public view override returns(uint256){
//     //     return lendingPool.getReserveNormalizedIncome(underlying);
//     // }
//     function getCurrentTimestamp() public view returns (uint256 result) {
//         result = Time.blockTimestampScaled();
//     }

//     function writeRateTest(address underlying, bool isStartRate) public {
//         writeRate(underlying);

//         if (isStartRate) {
//             startRate = rates[underlying][Time.blockTimestampScaled()];
//         } else {
//             endRate = rates[underlying][Time.blockTimestampScaled()];
//         }

//     }

// }
