// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IERC20Minimal.sol";
import "../interfaces/IPeriphery.sol";
import "../core_libraries/SafeTransferLib.sol";

// deposit
// rebalance
/// strategy off-chain invokes the rebalance function based on a model for tick range setting
//// bollinger bands
//// apy upper and lower bounds from the margin engine
//// f(time delta from now) -> come up with bounds on realized fixedRate -> optimial tick range
// withdraw
/// when can you withdraw (only after maturity of a pool)
/// is there room for more flexibility where the vault always keeps some cash for withdrawals 
/// and discincentivises withdraws with fees if done before maturity

// extra
// ownership
// erc20 lp tokens --> represent share of the vault strategy
//// create fungible erc20 assets that represent active lp strategies
//// they can then be used as collateral and priced...
// margin management & margin requirements
/// dynamically adjusting margin depending on volatility and/or apy bounds
// liquidity rolling
//// from one maturity into another
// compounding
//// frequency of fee collection (gas cost) vs. benefits from compound margin
// active IRS strategy alongside active LP strategy
// use of apy bounds to derive rebalancing tick range

// things to keep in mind
// mean reversion
// liquidations
// funding rate risk

contract TestActiveLPManagementStrategy {

    using SafeCast for uint256;
    using SafeCast for int256;

    IMarginEngine public marginEngine;
    IVAMM public vamm;
    IERC20Minimal public underlyingToken;
    IPeriphery public periphery;

    using SafeTransferLib for IERC20Minimal;

    uint256 public constant LEVERAGE = 5; // 5x multiplier

    int24 public tickLower;
    int24 public tickUpper;

    function setMarginEngineAndVAMM(
        IMarginEngine _marginEngine,
        IPeriphery _periphery
    ) external {
        // in order to restrict this function to only be callable by the owner of the bot you can apply the onlyOwner modifier by OZ
        require(address(_marginEngine) != address(0), "me must exist");
        require(
            (address(marginEngine) != address(_marginEngine)),
            "me already set"
        );
        marginEngine = _marginEngine;
        vamm = marginEngine.vamm();
        underlyingToken = marginEngine.underlyingToken();
        periphery = _periphery;
    }

    
    function _burn() internal {

    }
    
    function _mint(uint256 _marginDelta) internal {

        uint256 notionalToMint = depositAmountInUnderlyingTokens * LEVERAGE;
        periphery.mintOrBurn(IPeriphery.MintOrBurnParams({
            marginEngine: marginEngine,
            tickLower: tickLower,
            tickUpper: tickUpper,
            notional: notionalToMint,
            isMint: true,
            marginDelta: _marginDelta
        }));

    }
    
    function deposit(uint256 depositAmountInUnderlyingTokens) external {
        require(
            depositAmountInUnderlyingTokens > 0,
            "deposit must be positive"
        );

        underlyingToken.safeTransferFrom(
            msg.sender,
            address(this),
            depositAmountInUnderlyingTokens
        );

        _mint(depositAmountInUnderlyingTokens);

    }

    // the owner of the rebalance could be a multisig of operators
    function rebalance(
        int24 _updatedTickLower,
        int24 _updatedTickUpper
    ) external {

        // burn all liquidity
        _burn();

        // unwind to net out the position
        _unwind();

        // manually calculate the settlement cashflow
        uint256 marginToWithdraw = _calculateMarginToWithdraw();
        
        // withdraw margin net settlement cashflow
        marginEngine.updatePositionMargin(
            address(this),
            tickLower,
            tickUpper,
            -marginToWithdraw.toInt256()
        );
        
        // update tickLower & tickUpper
        (tickLower, tickUpper) = (_updatedTickLower, _updatedTickUpper);

        // mint liquidity in the updated tick range
        _mint(marginToWithdraw);

    }
}
