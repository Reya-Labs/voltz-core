// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

pragma abicoder v2;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IPeriphery.sol";
import "../utils/TickMath.sol";
import "./peripheral_libraries/LiquidityAmounts.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../core_libraries/SafeTransferLib.sol";
import "../core_libraries/Tick.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Periphery is IPeriphery {
    using SafeCast for uint256;
    using SafeCast for int256;

    using SafeTransferLib for IERC20Minimal;

    /// @dev Voltz Protocol vamm => LP Notional Cap in Underlying Tokens
    /// @dev LP notional cap of zero implies no notional cap
    /// @inheritdoc IPeriphery
    mapping(IVAMM => uint256) public override lpNotionalCaps;

    /// @dev amount of notional (coming from the periphery) in terms of underlying tokens taken up by LPs in a given VAMM
    /// @inheritdoc IPeriphery
    mapping(IVAMM => uint256) public override lpNotionalCumulatives;

    modifier vammOwnerOnly(IVAMM _vamm) {
        require(address(_vamm) != address(0), "me addr zero");
        address vammOwner = OwnableUpgradeable(address(_vamm)).owner();
        require(msg.sender == vammOwner, "only me owner");
        _;
    }

    function checkLPNotionalCap(
        IVAMM _vamm,
        uint256 _notionalDelta,
        bool _isMint
    ) internal {
        if (_isMint) {
            lpNotionalCumulatives[_vamm] += _notionalDelta;
            uint256 _lpNotionalCap = lpNotionalCaps[_vamm];

            if (_lpNotionalCap > 0) {
                /// @dev if > 0 the cap assumed to have been set, if == 0 assume no cap by convention
                require(
                    lpNotionalCumulatives[_vamm] < _lpNotionalCap,
                    "lp cap limit"
                );
            }
        } else {
            lpNotionalCumulatives[_vamm] -= _notionalDelta;
        }
    }

    function setLPNotionalCap(IVAMM _vamm, uint256 _lpNotionalCapNew)
        external
        vammOwnerOnly(_vamm)
    {
        if (lpNotionalCaps[_vamm] != _lpNotionalCapNew) {
            lpNotionalCaps[_vamm] = _lpNotionalCapNew;
            emit NotionalCap(_vamm, lpNotionalCaps[_vamm]);
        }
    }

    function updatePositionMargin(
        IMarginEngine _marginEngine,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 _marginDelta
    ) internal {
        IERC20Minimal _underlyingToken = _marginEngine.underlyingToken();
        _underlyingToken.safeTransferFrom(
            msg.sender,
            address(this),
            _marginDelta
        );
        _underlyingToken.approve(address(_marginEngine), _marginDelta);
        _marginEngine.updatePositionMargin(
            msg.sender,
            _tickLower,
            _tickUpper,
            _marginDelta.toInt256()
        );
    }

    /// @notice Add liquidity to an initialized pool
    function mintOrBurn(MintOrBurnParams memory params)
        external
        override
        returns (int256 positionMarginRequirement)
    {
        Tick.checkTicks(params.tickLower, params.tickUpper);

        IVAMM vamm = params.marginEngine.vamm();
        checkLPNotionalCap(vamm, params.notional, params.isMint);

        IVAMM.VAMMVars memory _v = vamm.vammVars();
        bool vammUnlocked = _v.sqrtPriceX96 != 0;

        // get sqrt ratios

        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(params.tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(params.tickUpper);

        // initialize the vamm at midTick

        if (!vammUnlocked) {
            int24 midTick = (params.tickLower + params.tickUpper) / 2;
            uint160 sqrtRatioAtMidTickX96 = TickMath.getSqrtRatioAtTick(
                midTick
            );
            vamm.initializeVAMM(sqrtRatioAtMidTickX96);
        }

        // if margin delta is positive, top up position margin

        if (params.marginDelta > 0) {
            updatePositionMargin(
                params.marginEngine,
                params.tickLower,
                params.tickUpper,
                params.marginDelta
            );
        }

        // compute the liquidity amount for the amount of notional (amount1) specified

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
            sqrtRatioAX96,
            sqrtRatioBX96,
            params.notional
        );

        positionMarginRequirement = 0;
        if (params.isMint) {
            positionMarginRequirement = vamm.mint(
                msg.sender,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        } else {
            // invoke a burn
            positionMarginRequirement = vamm.burn(
                msg.sender,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        }
    }

    function swap(SwapPeripheryParams memory params)
        external
        override
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement,
            int24 _tickAfter
        )
    {
        Tick.checkTicks(params.tickLower, params.tickUpper);

        IVAMM _vamm = params.marginEngine.vamm();

        if ((params.tickLower == 0) && (params.tickUpper == 0)) {
            int24 tickSpacing = _vamm.tickSpacing();
            IVAMM.VAMMVars memory _v = _vamm.vammVars();
            /// @dev assign default values to the upper and lower ticks

            int24 _tickLower = _v.tick - tickSpacing;
            int24 _tickUpper = _v.tick + tickSpacing;
            if (_tickLower < TickMath.MIN_TICK) {
                _tickLower = TickMath.MIN_TICK;
            }

            if (_tickUpper > TickMath.MAX_TICK) {
                _tickUpper = TickMath.MAX_TICK;
            }

            /// @audit add unit testsl, checks of tickLower/tickUpper divisiblilty by tickSpacing
            params.tickLower = _tickLower;
            params.tickUpper = _tickUpper;
        }

        // if margin delta is positive, top up position margin

        if (params.marginDelta > 0) {
            updatePositionMargin(
                params.marginEngine,
                params.tickLower,
                params.tickUpper,
                params.marginDelta
            );
        }

        int256 amountSpecified;

        if (params.isFT) {
            amountSpecified = params.notional.toInt256();
        } else {
            amountSpecified = -params.notional.toInt256();
        }

        IVAMM.SwapParams memory swapParams = IVAMM.SwapParams({
            recipient: msg.sender,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: params.sqrtPriceLimitX96 == 0
                ? (
                    !params.isFT
                        ? TickMath.MIN_SQRT_RATIO + 1
                        : TickMath.MAX_SQRT_RATIO - 1
                )
                : params.sqrtPriceLimitX96,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper
        });

        (
            _fixedTokenDelta,
            _variableTokenDelta,
            _cumulativeFeeIncurred,
            _fixedTokenDeltaUnbalanced,
            _marginRequirement
        ) = _vamm.swap(swapParams);
        _tickAfter = _vamm.vammVars().tick;
    }

    function getCurrentTick(IMarginEngine marginEngine)
        external
        view
        override
        returns (int24 currentTick)
    {
        IVAMM vamm = marginEngine.vamm();
        currentTick = vamm.vammVars().tick;
    }
}
