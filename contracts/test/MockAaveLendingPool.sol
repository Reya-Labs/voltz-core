// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/aave/IAToken.sol";
import "../utils/Printer.sol";

/// @notice This Mock Aave pool can be used in 3 ways
/// - change the rate to a fixed value (`setReserveNormalizedIncome`)
/// - configure the rate to alter over time (`setFactorPerSecondInRay`) for more dynamic testing
contract MockAaveLendingPool is IAaveV2LendingPool {
    mapping(IERC20Minimal => uint256) internal reserveNormalizedIncome;
    mapping(IERC20Minimal => uint256) internal reserveNormalizedVariableDebt;
    mapping(IERC20Minimal => uint256) internal startTime;
    mapping(IERC20Minimal => uint256) internal factorPerSecondInRay; // E.g. 1000000001000000000000000000 for 0.0000001% per second = ~3.2% APY

    mapping(IERC20Minimal => IAaveV2LendingPool.ReserveData) internal _reserves;

    function getReserveNormalizedIncome(IERC20Minimal _underlyingAsset)
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

    function getReserveNormalizedVariableDebt(IERC20Minimal _underlyingAsset)
        public
        view
        returns (uint256)
    {
        uint256 factorPerSecond = factorPerSecondInRay[_underlyingAsset];
        if (factorPerSecond > 0) {
            uint256 secondsSinceNormalizedVariableDebtSet = block.timestamp -
                startTime[_underlyingAsset];
            return
                PRBMathUD60x18.mul(
                    reserveNormalizedVariableDebt[_underlyingAsset],
                    PRBMathUD60x18.pow(
                        factorPerSecond,
                        secondsSinceNormalizedVariableDebtSet
                    )
                );
        } else {
            return reserveNormalizedVariableDebt[_underlyingAsset];
        }
    }

    function setReserveNormalizedIncome(
        IERC20Minimal _underlyingAsset,
        uint256 _reserveNormalizedIncome
    ) public {
        reserveNormalizedIncome[_underlyingAsset] = _reserveNormalizedIncome;
        startTime[_underlyingAsset] = block.timestamp;
    }

    function setReserveNormalizedVariableDebt(
        IERC20Minimal _underlyingAsset,
        uint256 _reserveNormalizedVariableDebt
    ) public {
        reserveNormalizedVariableDebt[_underlyingAsset] = _reserveNormalizedVariableDebt;
        startTime[_underlyingAsset] = block.timestamp;
    }

    function setFactorPerSecondInRay(
        IERC20Minimal _underlyingAsset,
        uint256 _factorPerSecondInRay
    ) public {
        factorPerSecondInRay[_underlyingAsset] = _factorPerSecondInRay;
    }

    function initReserve(IERC20Minimal asset, address aTokenAddress) external {
        IAaveV2LendingPool.ReserveData memory reserveData;
        reserveData.aTokenAddress = aTokenAddress;

        _reserves[asset] = reserveData;
    }

    /**
     * @dev Returns the state and configuration of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The state of the reserve
     **/
    function getReserveData(IERC20Minimal asset)
        external
        view
        override
        returns (IAaveV2LendingPool.ReserveData memory)
    {
        return _reserves[asset];
    }

    function withdraw(
        IERC20Minimal asset,
        uint256 amount,
        address to
    ) external override returns (uint256) {
        ReserveData storage reserve = _reserves[asset];
        address aToken = reserve.aTokenAddress;

        uint256 userBalance = IERC20Minimal(aToken).balanceOf(msg.sender);

        uint256 amountToWithdraw = amount;

        if (amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }

        IAToken(aToken).burn(
            msg.sender,
            to,
            amountToWithdraw,
            getReserveNormalizedIncome(asset)
        );

        return amountToWithdraw;
    }
}
