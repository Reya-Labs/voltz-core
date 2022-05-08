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

        uint256 notionalToMint = depositAmountInUnderlyingTokens * LEVERAGE;
        periphery.mintOrBurn(IPeriphery.MintOrBurnParams({
            marginEngine: marginEngine,
            tickLower: tickLower,
            tickUpper: tickUpper,
            notional: notionalToMint,
            isMint: true,
            marginDelta: depositAmountInUnderlyingTokens
        }));
    }

    // the owner of the rebalance could be a multisig of operators
    function rebalance(
        int24 _tickLower,
        int24 _tickUpper
    ) external {

        // require checks

        // burn all liquidity

        // swap to net out the position

        // withdraw all margin

        // manually calculate the settlement cashflow

        // todo: figure out how to check for the margin requirement?


    }
}
