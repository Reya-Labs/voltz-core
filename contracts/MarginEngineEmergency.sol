// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;
import "./core_libraries/Tick.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/fcms/IFCM.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./core_libraries/SafeTransferLib.sol";
import "./storage/MarginEngineStorage.sol";
import "./utils/SafeCastUni.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "contracts/utils/SqrtPriceMath.sol";

contract MarginEngineEmergency is
    MarginEngineStorage,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    using SafeCastUni for uint256;
    using SafeCastUni for int256;
    using Tick for mapping(int24 => Tick.Info);

    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    using SafeTransferLib for IERC20Minimal;

    /// @dev Seconds in a year
    int256 public constant SECONDS_IN_YEAR = 31536000e18;

    uint256 public constant ONE_UINT = 1e18;
    int256 public constant ONE = 1e18;

    uint256 public constant MAX_LOOKBACK_WINDOW_IN_SECONDS = 315360000; // ten years
    uint256 public constant MIN_LOOKBACK_WINDOW_IN_SECONDS = 3600; // one hour
    uint256 public constant MAX_CACHE_MAX_AGE_IN_SECONDS = 1209600; // two weeks
    uint256 public constant MAX_LIQUIDATOR_REWARD_WAD = 3e17; // 30%

    // To authorize the owner to upgrade the contract we implement _authorizeUpgrade with the onlyOwner modifier.
    // ref: https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice _transferMargin function which:
    /// @dev Transfers funds in from account if _marginDelta is positive, or out to account if _marginDelta is negative
    /// @dev if the margiDelta is positive, we conduct a safe transfer from the _account address to the address of the MarginEngine
    /// @dev if the marginDelta is negative, the user wishes to withdraw underlying tokens from the MarginEngine,
    /// @dev in that case we first check the balance of the marginEngine in terms of the underlying tokens, if the balance is sufficient to cover the margin transfer, then we cover it via a safeTransfer
    /// @dev if the marginEngineBalance is not sufficient to cover the marginDelta then we cover the remainingDelta by invoking the transferMarginToMarginEngineTrader function of the fcm which in case of Aave will calls the Aave withdraw function to settle with the MarginEngine in underlying tokens
    function _transferMargin(address _account, int256 _marginDelta) internal {
        if (_marginDelta > 0) {
            _underlyingToken.safeTransferFrom(
                _account,
                address(this),
                uint256(_marginDelta)
            );
        } else {
            uint256 _marginEngineBalance = _underlyingToken.balanceOf(
                address(this)
            );

            uint256 _remainingDeltaToCover;
            unchecked {
                _remainingDeltaToCover = uint256(-_marginDelta);
            }

            if (_remainingDeltaToCover > _marginEngineBalance) {
                if (_marginEngineBalance > 0) {
                    _remainingDeltaToCover -= _marginEngineBalance;
                    _underlyingToken.safeTransfer(
                        _account,
                        _marginEngineBalance
                    );
                }
                _fcm.transferMarginToMarginEngineTrader(
                    _account,
                    _remainingDeltaToCover
                );
            } else {
                _underlyingToken.safeTransfer(_account, _remainingDeltaToCover);
            }
        }
    }

    function emergencyWithdrawal(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external {
        require(owner != address(0), "O0");

        Position.Info storage position = positions.get(
            owner,
            tickLower,
            tickUpper
        );

        if (owner != msg.sender && !_factory.isApproved(owner, msg.sender)) {
            revert CustomErrors.OnlyOwnerCanUpdatePosition();
        }

        int256 marginToWithdraw = -position.margin;
        position.updateMarginViaDelta(marginToWithdraw);

        _transferMargin(msg.sender, marginToWithdraw);
    }
}
