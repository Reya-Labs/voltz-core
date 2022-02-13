pragma solidity ^0.8.0;
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../aave/AaveDataTypes.sol";

/// @notice This Mock Aave pool can be used in 3 ways
/// - change the rate to a fixed value (`setReserveNormalizedIncome`)
/// - configure the rate to alter over time (`setFactorPerSecondInRay`) for more dynamic testing
contract MockAaveLendingPool is IAaveV2LendingPool {
    mapping(address => uint256) internal reserveNormalizedIncome;
    mapping(address => uint256) internal startTime;
    mapping(address => uint256) internal factorPerSecondInRay; // E.g. 1000000001000000000000000000 for 0.0000001% per second = ~3.2% APY

    mapping(address => AaveDataTypes.ReserveData) internal _reserves;
    
    function getReserveNormalizedIncome(address _underlyingAsset)
        public
        view
        override
        returns (uint256)
    {
        uint256 factorPerSecond = factorPerSecondInRay[_underlyingAsset];
        if (factorPerSecond > 0) {
            uint256 secondsSinceNormalizedIncomeSet = block.timestamp -
                startTime[_underlyingAsset];
            return
                /// @audit isn't reserve normalised income in terms of ray, how can we use this?
                PRBMathUD60x18.mul(
                    reserveNormalizedIncome[_underlyingAsset],
                    PRBMathUD60x18.pow(
                        factorPerSecond,
                        secondsSinceNormalizedIncomeSet
                    )
                );
        } else {
            return reserveNormalizedIncome[_underlyingAsset];
        }
    }

    function setReserveNormalizedIncome(
        address _underlyingAsset,
        uint256 _reserveNormalizedIncome
    ) public {
        reserveNormalizedIncome[_underlyingAsset] = _reserveNormalizedIncome;
        startTime[_underlyingAsset] = block.timestamp;
    }

    function setFactorPerSecondInRay(
        address _underlyingAsset,
        uint256 _factorPerSecondInRay
    ) public {
        factorPerSecondInRay[_underlyingAsset] = _factorPerSecondInRay;
    }


  function initReserve(
    address asset,
    address aTokenAddress
  ) external override {
    
    AaveDataTypes.ReserveData memory reserveData;
    reserveData.aTokenAddress = aTokenAddress;

    _reserves[asset] = reserveData;
  }

    /**
    * @dev Returns the state and configuration of the reserve
    * @param asset The address of the underlying asset of the reserve
    * @return The state of the reserve
    **/
  function getReserveData(address asset)
    external
    view
    override
    returns (AaveDataTypes.ReserveData memory)
  {
    return _reserves[asset];
  }
  
}
