// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IERC20Minimal.sol";
import "../interfaces/IPeriphery.sol";
import "../core_libraries/SafeTransferLib.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core_libraries/FixedAndVariableMath.sol";

contract TestActiveLPManagementStrategy is Ownable {
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
    ) external onlyOwner {
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
        // can introduce more granular controls
        if (tickUpper > tickLower) {
            Position.Info memory position = marginEngine.getPosition(
                address(this),
                tickLower,
                tickUpper
            );

            uint128 positionLiquidity = position._liquidity;

            if (positionLiquidity > 0) {
                vamm.burn(
                    address(this),
                    tickLower,
                    tickUpper,
                    positionLiquidity
                );
            }
        }
    }

    function _mintAll() internal {
        uint256 marginInactive = underlyingToken.balanceOf(address(this));
        if (marginInactive > 0) {
            uint256 notionalToMint = marginInactive * LEVERAGE;
            underlyingToken.approve(address(periphery), marginInactive);

            periphery.mintOrBurn(
                IPeriphery.MintOrBurnParams({
                    marginEngine: marginEngine,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    notional: notionalToMint,
                    isMint: true,
                    marginDelta: marginInactive.toInt256()
                })
            );
        }
    }

    function _mint(uint256 _marginDelta) internal {
        uint256 notionalToMint = _marginDelta * LEVERAGE;

        underlyingToken.approve(address(periphery), _marginDelta);
        periphery.mintOrBurn(
            IPeriphery.MintOrBurnParams({
                marginEngine: marginEngine,
                tickLower: tickLower,
                tickUpper: tickUpper,
                notional: notionalToMint,
                isMint: true,
                marginDelta: _marginDelta.toInt256()
            })
        );
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

    function _calculateMarginToWithdraw()
        internal
        returns (int256 _marginToWithdraw)
    {
        if (tickUpper > tickLower) {
            // assumes lp has no unnetted variable liabilities

            // get total position margin

            Position.Info memory _position = marginEngine.getPosition(
                address(this),
                tickLower,
                tickUpper
            );

            _marginToWithdraw = _position.margin;

            // get settlement cashflow
            int256 _settlementCashflow = FixedAndVariableMath
                .calculateSettlementCashflow(
                    _position.fixedTokenBalance,
                    0, // _position.variableTokenBalance,
                    marginEngine.termStartTimestampWad(),
                    marginEngine.termEndTimestampWad(),
                    0 // variable factor is zero since does not apply in case variableTokenBalance is zero
                );

            if (_settlementCashflow < 0) {
                _marginToWithdraw += _settlementCashflow;
            }

            _marginToWithdraw -= 10**18; // temp: subtract one wad
        }
    }

    // the owner of the rebalance could be a multisig of operators
    function rebalance(int24 _updatedTickLower, int24 _updatedTickUpper)
        external
        onlyOwner
    {
        // burn all liquidity
        _burn();

        // unwind to net out the position (if unnetted fixed and variable token balances)
        // _unwind();

        // manually calculate the settlement cashflow
        int256 marginToWithdraw = _calculateMarginToWithdraw();

        if (marginToWithdraw > 0) {
            // withdraw margin net settlement cashflow
            marginEngine.updatePositionMargin(
                address(this),
                tickLower,
                tickUpper,
                -marginToWithdraw
            );
        }

        // update tickLower & tickUpper
        (tickLower, tickUpper) = (_updatedTickLower, _updatedTickUpper);

        // mint liquidity in the updated tick range
        _mintAll();
    }
}
