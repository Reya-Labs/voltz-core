// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

pragma abicoder v2;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IPeriphery.sol";
import "../utils/TickMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../core_libraries/SafeTransferLib.sol";
import "../core_libraries/Tick.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @dev inside mint or burn check if the position already has margin deposited and add it to the cumulative balance

contract Periphery is IPeriphery {
    using SafeCast for uint256;
    using SafeCast for int256;
    uint256 internal constant Q96 = 2**96;

    using SafeTransferLib for IERC20Minimal;

    /// @dev Voltz Protocol vamm => LP Margin Cap in Underlying Tokens
    /// @dev LP margin cap of zero implies no margin cap
    /// @inheritdoc IPeriphery
    mapping(IVAMM => int256) public override lpMarginCaps;

    /// @dev amount of margin (coming from the periphery) in terms of underlying tokens taken up by LPs in a given VAMM
    /// @inheritdoc IPeriphery
    mapping(IVAMM => int256) public override lpMarginCumulatives;

    /// @dev alpha lp margin mapping
    mapping(bytes32 => int256) internal lastAccountedMargin;

    modifier vammOwnerOnly(IVAMM _vamm) {
        require(address(_vamm) != address(0), "vamm addr zero");
        address vammOwner = OwnableUpgradeable(address(_vamm)).owner();
        require(msg.sender == vammOwner, "only vamm owner");
        _;
    }

    /// @notice Computes the amount of liquidity received for a given notional amount and price range
    /// @dev Calculates amount1 / (sqrt(upper) - sqrt(lower)).
    /// @param sqrtRatioAX96 A sqrt price representing the first tick boundary
    /// @param sqrtRatioBX96 A sqrt price representing the second tick boundary
    /// @param notionalAmount The amount of notional being sent in
    /// @return liquidity The amount of returned liquidity
    function getLiquidityForNotional(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint256 notionalAmount
    ) public pure returns (uint128 liquidity) {
        if (sqrtRatioAX96 > sqrtRatioBX96)
            (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        return
            FullMath
                .mulDiv(notionalAmount, Q96, sqrtRatioBX96 - sqrtRatioAX96)
                .toUint128();
    }

    function checkLPNotionalCap(
        IVAMM _vamm,
        bytes32 encodedPosition,
        int256 newMargin,
        bool isLPBefore,
        bool isLPAfter
    ) internal {
        if (isLPAfter) {
            // added some liquidity, need to account for margin
            lpMarginCumulatives[_vamm] -= lastAccountedMargin[encodedPosition];

            lastAccountedMargin[encodedPosition] = newMargin;

            lpMarginCumulatives[_vamm] += lastAccountedMargin[encodedPosition];
        } else {
            if (isLPBefore) {
                lpMarginCumulatives[_vamm] -= lastAccountedMargin[
                    encodedPosition
                ];

                lastAccountedMargin[encodedPosition] = 0;
            }
        }

        require(
            lpMarginCumulatives[_vamm] <= lpMarginCaps[_vamm],
            "lp cap limit"
        );
    }

    function setLPMarginCap(IVAMM _vamm, int256 _lpMarginCapNew)
        external
        override
        vammOwnerOnly(_vamm)
    {
        if (lpMarginCaps[_vamm] != _lpMarginCapNew) {
            lpMarginCaps[_vamm] = _lpMarginCapNew;
            emit MarginCap(_vamm, lpMarginCaps[_vamm]);
        }
    }

    function accountLPMarginCap(
        IVAMM _vamm,
        bytes32 encodedPosition,
        int256 newMargin,
        bool isLPBefore,
        bool isLPAfter
    ) internal {
        if (isLPAfter) {
            // added some liquidity, need to account for margin
            lpMarginCumulatives[_vamm] -= lastAccountedMargin[encodedPosition];

            lastAccountedMargin[encodedPosition] = newMargin;

            lpMarginCumulatives[_vamm] += lastAccountedMargin[encodedPosition];
        } else {
            if (isLPBefore) {
                lpMarginCumulatives[_vamm] -= lastAccountedMargin[
                    encodedPosition
                ];

                lastAccountedMargin[encodedPosition] = 0;
            }
        }

        require(
            lpMarginCumulatives[_vamm] <= lpMarginCaps[_vamm],
            "lp cap limit"
        );
    }

    function settlePositionAndWithdrawMargin(
        IMarginEngine _marginEngine,
        address _owner,
        int24 _tickLower,
        int24 _tickUpper
    ) external override {
        _marginEngine.settlePosition(_owner, _tickLower, _tickUpper);

        updatePositionMargin(_marginEngine, _tickLower, _tickUpper, 0, true); // fully withdraw
    }

    function updatePositionMargin(
        IMarginEngine _marginEngine,
        int24 _tickLower,
        int24 _tickUpper,
        int256 _marginDelta,
        bool _fullyWithdraw
    ) public override {
        Position.Info memory _position = _marginEngine.getPosition(
            msg.sender,
            _tickLower,
            _tickUpper
        );

        IERC20Minimal _underlyingToken = _marginEngine.underlyingToken();

        if (_fullyWithdraw) {
            _marginDelta = -_position.margin;
        }

        if (_marginDelta > 0) {
            _underlyingToken.safeTransferFrom(
                msg.sender,
                address(this),
                _marginDelta.toUint256()
            );
            _underlyingToken.approve(
                address(_marginEngine),
                _marginDelta.toUint256()
            );
        }

        _marginEngine.updatePositionMargin(
            msg.sender,
            _tickLower,
            _tickUpper,
            _marginDelta
        );

        _position = _marginEngine.getPosition(
            msg.sender,
            _tickLower,
            _tickUpper
        );

        bool _isAlpha = _marginEngine.isAlpha();
        IVAMM _vamm = _marginEngine.vamm();

        if (_isAlpha && _position._liquidity > 0) {
            bytes32 encodedPosition = keccak256(
                abi.encodePacked(
                    msg.sender,
                    address(_vamm),
                    address(_marginEngine),
                    _tickLower,
                    _tickUpper
                )
            );
            accountLPMarginCap(
                _vamm,
                encodedPosition,
                _position.margin,
                true,
                true
            );
        }
    }

    /// @notice Add liquidity to an initialized pool
    function mintOrBurn(MintOrBurnParams memory params)
        external
        override
        returns (int256 positionMarginRequirement)
    {
        Tick.checkTicks(params.tickLower, params.tickUpper);

        IVAMM vamm = params.marginEngine.vamm();

        Position.Info memory _position = params.marginEngine.getPosition(
            msg.sender,
            params.tickLower,
            params.tickUpper
        );

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

        if (params.marginDelta != 0) {
            updatePositionMargin(
                params.marginEngine,
                params.tickLower,
                params.tickUpper,
                params.marginDelta,
                false // _fullyWithdraw
            );
        }

        // compute the liquidity amount for the amount of notional (amount1) specified

        uint128 liquidity = getLiquidityForNotional(
            sqrtRatioAX96,
            sqrtRatioBX96,
            params.notional
        );

        bool isLPBefore = _position._liquidity > 0;

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

        _position = params.marginEngine.getPosition(
            msg.sender,
            params.tickLower,
            params.tickUpper
        );

        bool isLPAfter = _position._liquidity > 0;

        if (params.marginEngine.isAlpha() && (isLPBefore || isLPAfter)) {
            bytes32 encodedPosition = keccak256(
                abi.encodePacked(
                    msg.sender,
                    address(vamm),
                    address(params.marginEngine),
                    params.tickLower,
                    params.tickUpper
                )
            );
            accountLPMarginCap(
                vamm,
                encodedPosition,
                _position.margin,
                isLPBefore,
                isLPAfter
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

            /// @audit add unit tests, checks of tickLower/tickUpper divisiblilty by tickSpacing
            params.tickLower = _tickLower;
            params.tickUpper = _tickUpper;
        }

        // if margin delta is positive, top up position margin

        if (params.marginDelta > 0) {
            updatePositionMargin(
                params.marginEngine,
                params.tickLower,
                params.tickUpper,
                params.marginDelta.toInt256(),
                false // _fullyWithdraw
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
