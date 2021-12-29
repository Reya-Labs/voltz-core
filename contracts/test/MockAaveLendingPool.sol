pragma solidity ^0.8.0;
import "../interfaces/aave/IAaveV2LendingPool.sol";

contract MockAaveLendingPool is IAaveV2LendingPool {

    mapping(address => uint256) internal reserveNormalizedIncome;

    function getReserveNormalizedIncome(address _underlyingAsset) public override view returns (uint256) {
        return reserveNormalizedIncome[_underlyingAsset];
    }

    function setReserveNormalizedIncome(address _underlyingAsset, uint256 _reserveNormalizedIncome) public {
        reserveNormalizedIncome[_underlyingAsset] = _reserveNormalizedIncome;
    }
}