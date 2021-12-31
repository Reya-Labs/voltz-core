pragma solidity ^0.8.0;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/AaveRateOracle.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../utils/WayRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";

contract TestRateOracle is AaveRateOracle {

  // uint256 public time;
  int24 public tick;
  uint128 public liquidity;

  uint256 public latestObservedRateValue;
  uint256 public latestRateFromTo;

  uint256 public latestBeforeOrAtRateValue;
  uint256 public latestAfterOrAtRateValue;

  uint256 public latestVariableFactor;

  uint256 public latestHistoricalApy;


  // todo: rateOracleId should be a function of underlyingProtocol and underlyingToken?
  constructor(address aaveLendingPool, bytes32 rateOracleId, address underlying) AaveRateOracle(aaveLendingPool, rateOracleId, underlying) {
    
    // todo: if not done manually, doesn't work for some reason
    aaveLendingPool = aaveLendingPool;
    rateOracleId = rateOracleId;
    underlying = underlying;

    // console.log("Test Contract: Aave lending pool address is: ", aaveLendingPool);
    // // console.log("Test Contract: Rate Oracle ID is: ", rateOracleId);
    // console.log("Test Contract: Underlying is: ", underlying);
  }


  struct InitializeParams {
      // uint256 time;
      int24 tick;
      uint128 liquidity;
  }

  function initializeTestRateOracle(InitializeParams calldata params) external {
    require(oracleVars.rateCardinality == 0, "already initialized");
    tick = params.tick;
    liquidity = params.liquidity;
    initialize();
    console.log("Test Contracts: ", oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);
  }


  function getOracleVars() external view returns (uint16, uint16, uint16) {
    return (oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);
  }

  function testGetReserveNormalizedIncome() external view returns(uint256){
    // console.log("Test Contract: Aave lending pool address is", aaveLendingPool);
    return getReserveNormalizedIncome(underlying);
  }

  function testGrow(uint16 _rateCardinalityNext) external {
    oracleVars.rateCardinalityNext = grow(oracleVars.rateCardinalityNext, _rateCardinalityNext);
  }

  function update() external {
    (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);
  }

  function getRate(uint16 index) external view returns (uint256, uint256) {
    Rate memory rate = rates[index];
    return (rate.timestamp, rate.rateValue);
  }

  function testObserveSingle(uint256 queriedTime) external returns (uint256 rateValue) {
    latestObservedRateValue = observeSingle(Time.blockTimestampScaled(), queriedTime, oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);
    return latestObservedRateValue;
  }

  function testGetRateFromTo(uint256 from, uint256 to) external returns (uint256) {
    latestRateFromTo = getRateFromTo(from, to);
    return latestRateFromTo;
  }

  function testInterpolateRateValue(
        uint256 beforeOrAtRateValue,
        uint256 apyFromBeforeOrAtToAtOrAfter,
        uint256 timeDeltaBeforeOrAtToQueriedTime
  ) external pure returns (uint256) {

    return interpolateRateValue(beforeOrAtRateValue, apyFromBeforeOrAtToAtOrAfter, timeDeltaBeforeOrAtToQueriedTime);

  }

  function testBinarySearch(uint256 target) external view returns (uint256 beforeOrAtRateValue, uint256 afterOrAtRateValue) {
    (Rate memory beforeOrAt, Rate memory atOrAfter) = binarySearch(target, oracleVars.rateIndex, oracleVars.rateCardinality);
    beforeOrAtRateValue = beforeOrAt.rateValue;
    afterOrAtRateValue = atOrAfter.rateValue;
  }


  function testGetSurroundingRates(uint256 target) external {

    (Rate memory beforeOrAt, Rate memory atOrAfter) = getSurroundingRates(target, oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);

    latestBeforeOrAtRateValue = beforeOrAt.rateValue;
    latestAfterOrAtRateValue = atOrAfter.rateValue;

  } 

  function testComputeApyFromRate(uint256 rateFromTo, uint256 timeInYears) external pure returns (uint256) {
    return computeApyFromRate(rateFromTo, timeInYears);
  }

  function testVariableFactor(uint256 termStartTimestamp, uint256 termEndTimestamp) external {
    latestVariableFactor = variableFactor(termStartTimestamp, termEndTimestamp);
  }

  // function testGetHistoricalApy() external {
  //   latestHistoricalApy = getHistoricalApy();
  // }

  // todo: temporary until fixed
  function getHistoricalApy() public view override returns (uint256) {
    return 10**17;
  }


}
