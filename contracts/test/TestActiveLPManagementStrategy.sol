// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IERC20Minimal.sol";
import "../interfaces/IPeriphery.sol";


// deposit
// rebalance
// withdraw

// extra
// ownership
// erc20 lp tokens
// margin management & margin requirements
// liquidity rolling
// compounding
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

    uint256 public constant LEVERAGE = 5; // 5x multiplier


    int24 public tickLower;
    int24 public tickUpper;

    function setMarginEngineAndVAMM(IMarginEngine _marginEngine, IPeriphery _periphery) external {
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

        require(depositAmountInUnderlyingTokens > 0, "deposit must be positive");
        
        underlyingToken.safeTransferFrom(msg.sender, address(this), depositAmountInUnderlyingTokens);

        uint256 notionalToMint = depositAmountInUnderlyingTokens * LEVERAGE; 
        periphery.mintOrBurn(
            {
                marginEngine: marginEngine, 
                tickLower: tickLower,
                tickUpper: tickUpper,
                notional: notionalToMint,
                usMint: true,
                marginDelta: depositAmountInUnderlyingTokens
            }
        );

    }

    function rebalance(int24 _tickLower, int24 _tickUpper, int256 notionalDelta) external {

        

    }



}
