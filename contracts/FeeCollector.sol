// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./storage/FeeCollectorStorage.sol";
import "./interfaces/IFeeCollector.sol";
import "./interfaces/IERC20Minimal.sol";
import "./core_libraries/SafeTransferLib.sol";

/**
todo: remove
Current strategy
- fee collection should be called on a ME level by the multisig, giving the recepient as FeeCollector
    - best to call the above at the end of a pool
- fee distribution is called in the Fee collector on each underlying token
- fee collection is called on each token
 */
contract FeeCollector is
    FeeCollectorStorage,
    IFeeCollector,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeTransferLib for IERC20Minimal;

    /// @dev Used for identifying cases when the entire fund's balance is to be used as an input
    /// This value is equivalent to 1<<255, i.e. a singular 1 in the most significant bit.
    uint256 internal constant ENTIRE_BALANCE = 0x8000000000000000000000000000000000000000000000000000000000000000;

    // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() external override initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    // To authorize the owner to upgrade the contract we implement _authorizeUpgrade with the onlyOwner modifier.
    // ref: https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @inheritdoc IFeeCollector
    function distributeFees(address asset) public override onlyOwner returns (uint256 defaultFundsDelta, uint256 protocolFeesDelta) {
        // todo: check for roudups/downs of division
        uint256 contractBalance = IERC20Minimal(asset).balanceOf(address(this));
        if ( defaultFundPaused ) {
            protocolFees[asset] += contractBalance;

            protocolFeesDelta = contractBalance;
        } else {
            defaultFund[asset] += contractBalance/2;
            protocolFees[asset] += contractBalance/2;

            defaultFundsDelta = contractBalance/2;
            protocolFeesDelta = contractBalance/2;
        }
        emit FeeDistributed(asset, defaultFundsDelta, protocolFeesDelta);
    }

    /// @inheritdoc IFeeCollector
    function distributeAllFees(address[] memory assets) external override onlyOwner {
        for(uint256 i = 0; i < assets.length; i++) {
            distributeFees(assets[i]);
        }
    }

    /// @inheritdoc IFeeCollector
    function collectAllFees(address[] memory assets, bool fromDefaultFund) external override onlyOwner {
        for(uint256 i = 0; i < assets.length; i++) {
            collectFees(assets[i], ENTIRE_BALANCE, fromDefaultFund);
        }
    }

    /// @inheritdoc IFeeCollector
    function setDefaultFundPaused(bool _defaultFundPaused) external override onlyOwner {
        defaultFundPaused = _defaultFundPaused;
        emit DefaultFundPaused(_defaultFundPaused);
    }

    /// @inheritdoc IFeeCollector
    function collectFees(address asset, uint256 specifiedAmount, bool fromDefaultFund) public override onlyOwner returns (uint256 defaultFundsDelta, uint256 protocolFeesDelta) {
        uint256 amount = specifiedAmount == ENTIRE_BALANCE ? 
            (fromDefaultFund ? defaultFund[asset] : protocolFees[asset]) :
            specifiedAmount;

        if (fromDefaultFund) {
            defaultFund[asset] -= amount;
            defaultFundsDelta = amount;
        } else {
            protocolFees[asset] -= amount;
            protocolFeesDelta = amount;
        }
        IERC20Minimal(asset).safeTransfer(msg.sender, amount);

        emit FeeCollected(asset, fromDefaultFund, amount);
    }

    /// @inheritdoc IFeeCollector
    function getDefaultFund(address asset) external view override returns (uint256) {
        return defaultFund[asset];
    }

    /// @inheritdoc IFeeCollector
    function getProtocolFees(address asset) external view override returns (uint256) {
        return protocolFees[asset];
    }

}
