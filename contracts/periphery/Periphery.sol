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
import "hardhat/console.sol";

/// @dev inside mint or burn check if the position already has margin deposited and add it to the cumulative balance

contract Periphery is IPeriphery {
    using SafeCast for uint256;
    using SafeCast for int256;
    uint256 internal constant Q96 = 2**96;

    using SafeTransferLib for IERC20Minimal;

    /// @dev Wrapped ETH interface
    IWETH public _weth;

    /// @dev Voltz Protocol vamm => LP Margin Cap in Underlying Tokens
    /// @dev LP margin cap of zero implies no margin cap
    mapping(IVAMM => int256) public _lpMarginCaps;

    /// @dev amount of margin (coming from the periphery) in terms of underlying tokens taken up by LPs in a given VAMM
    mapping(IVAMM => int256) public _lpMarginCumulatives;

    /// @dev alpha lp margin mapping
    mapping(bytes32 => int256) internal _lastAccountedMargin;

    modifier vammOwnerOnly(IVAMM vamm) {
        require(address(vamm) != address(0), "vamm addr zero");
        address vammOwner = OwnableUpgradeable(address(vamm)).owner();
        require(msg.sender == vammOwner, "only vamm owner");
        _;
    }

    constructor(IWETH weth_) public {
        _weth = weth_;
    }

    /// @inheritdoc IPeriphery
    function lpMarginCaps(IVAMM vamm) external view override returns (int256) {
        return _lpMarginCaps[vamm];
    }

    /// @inheritdoc IPeriphery
    function lpMarginCumulatives(IVAMM vamm) external view override returns (int256) {
        return _lpMarginCumulatives[vamm];
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

    function setLPMarginCap(IVAMM vamm, int256 lpMarginCapNew)
        external
        override
        vammOwnerOnly(vamm)
    {
        _lpMarginCaps[vamm] = lpMarginCapNew;
        emit MarginCap(vamm, _lpMarginCaps[vamm]);
    }

    function setLPMarginCumulative(IVAMM vamm, int256 lpMarginCumulative) 
        external
        override 
        vammOwnerOnly(vamm)
    {
        _lpMarginCumulatives[vamm] = lpMarginCumulative;
    }

    function accountLPMarginCap(
        IVAMM vamm,
        bytes32 encodedPosition,
        int256 newMargin,
        bool isLPBefore,
        bool isLPAfter
    ) internal {
        console.log("isLPBefore", isLPBefore);
        console.log("isLPAfter", isLPAfter);
        console.log("newMargin", newMargin.toUint256());
        if (isLPAfter) {
            // added some liquidity, need to account for margin
            console.log("margin before:", _lastAccountedMargin[encodedPosition].toUint256());
            _lpMarginCumulatives[vamm] -= _lastAccountedMargin[encodedPosition];

            _lastAccountedMargin[encodedPosition] = newMargin;

            console.log("margin after:", _lastAccountedMargin[encodedPosition].toUint256());
            _lpMarginCumulatives[vamm] += _lastAccountedMargin[encodedPosition];
        } else {
            if (isLPBefore) {
                _lpMarginCumulatives[vamm] -= _lastAccountedMargin[
                    encodedPosition
                ];
                console.log("margin before:", _lastAccountedMargin[encodedPosition].toUint256());

                _lastAccountedMargin[encodedPosition] = 0;
                console.log("margin before: 0");
            }
        }

        require(
            _lpMarginCumulatives[vamm] <= _lpMarginCaps[vamm],
            "lp cap limit"
        );
    }

    function settlePositionAndWithdrawMargin(
        IMarginEngine marginEngine,
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external override {
        marginEngine.settlePosition(owner, tickLower, tickUpper);

        updatePositionMargin(marginEngine, tickLower, tickUpper, 0, true); // fully withdraw
    }

    function updatePositionMargin(
        IMarginEngine marginEngine,
        int24 tickLower,
        int24 tickUpper,
        int256 marginDelta,
        bool fullyWithdraw
    ) public payable override {
        Position.Info memory position = marginEngine.getPosition(
            msg.sender,
            tickLower,
            tickUpper
        );

        bool isAlpha = marginEngine.isAlpha();
        IVAMM vamm = marginEngine.vamm();
        bytes32 encodedPosition = keccak256(
                abi.encodePacked(
                    msg.sender,
                    address(vamm),
                    address(marginEngine),
                    tickLower,
                    tickUpper
                )
            );

        if (isAlpha && position._liquidity > 0) {
            if (_lastAccountedMargin[encodedPosition] == 0) {
                _lastAccountedMargin[encodedPosition] = position.margin;
            }
        }

        IERC20Minimal underlyingToken = marginEngine.underlyingToken();

        if (fullyWithdraw) {
            marginDelta = -position.margin;
        }

        // if WETH pools, accept deposit only in ETH
        if (address(underlyingToken) == address(_weth)) {
            require(marginDelta <= 0, "INV");

            if (marginDelta < 0) {
                require(msg.value == 0, "INV");
                marginEngine.updatePositionMargin(
                    msg.sender,
                    tickLower,
                    tickUpper,
                    marginDelta
                );
            } else {
                if (msg.value > 0) {
                    uint256 ethPassed = msg.value;

                    _weth.deposit{value: msg.value}();

                    underlyingToken.approve(address(marginEngine), ethPassed);

                    marginEngine.updatePositionMargin(
                        msg.sender,
                        tickLower,
                        tickUpper,
                        ethPassed.toInt256()
                    );
                }
            }
        } else {
            if (marginDelta > 0) {
                underlyingToken.safeTransferFrom(
                    msg.sender,
                    address(this),
                    marginDelta.toUint256()
                );
                underlyingToken.approve(
                    address(marginEngine),
                    marginDelta.toUint256()
                );

                marginEngine.updatePositionMargin(
                    msg.sender,
                    tickLower,
                    tickUpper,
                    marginDelta
                );
            }
        }

        position = marginEngine.getPosition(
            msg.sender,
            tickLower,
            tickUpper
        );

        if (isAlpha && position._liquidity > 0) {
            accountLPMarginCap(
                vamm,
                encodedPosition,
                position.margin,
                true,
                true
            );
        }
    }

    /// @notice Add liquidity to an initialized pool
    function mintOrBurn(MintOrBurnParams memory params)
        external
        payable
        override
        returns (int256 positionMarginRequirement)
    {
        Tick.checkTicks(params.tickLower, params.tickUpper);

        IVAMM vamm = params.marginEngine.vamm();

        Position.Info memory position = params.marginEngine.getPosition(
            msg.sender,
            params.tickLower,
            params.tickUpper
        );

        bool isAlpha = params.marginEngine.isAlpha();
        bytes32 encodedPosition = keccak256(
                abi.encodePacked(
                    msg.sender,
                    address(vamm),
                    address(params.marginEngine),
                    params.tickLower,
                    params.tickUpper
                )
            );

        bool isLPBefore = position._liquidity > 0;
        if (isAlpha && isLPBefore) {
            if (_lastAccountedMargin[encodedPosition] == 0) {
                _lastAccountedMargin[encodedPosition] = position.margin;
            }
        }

        IVAMM.VAMMVars memory v = vamm.vammVars();
        bool vammUnlocked = v.sqrtPriceX96 != 0;

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

        if (params.marginDelta != 0 || msg.value > 0) {
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

        position = params.marginEngine.getPosition(
            msg.sender,
            params.tickLower,
            params.tickUpper
        );

        bool isLPAfter = position._liquidity > 0;

        if (isAlpha && (isLPBefore || isLPAfter)) {
            accountLPMarginCap(
                vamm,
                encodedPosition,
                position.margin,
                isLPBefore,
                isLPAfter
            );
        }
    }

    function swap(SwapPeripheryParams memory params)
        external
        payable
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

        IVAMM vamm = params.marginEngine.vamm();

        if ((params.tickLower == 0) && (params.tickUpper == 0)) {
            int24 tickSpacing = vamm.tickSpacing();
            IVAMM.VAMMVars memory v = vamm.vammVars();
            /// @dev assign default values to the upper and lower ticks

            int24 tickLower = v.tick - tickSpacing;
            int24 tickUpper = v.tick + tickSpacing;
            if (tickLower < TickMath.MIN_TICK) {
                tickLower = TickMath.MIN_TICK;
            }

            if (tickUpper > TickMath.MAX_TICK) {
                tickUpper = TickMath.MAX_TICK;
            }

            /// @audit add unit tests, checks of tickLower/tickUpper divisiblilty by tickSpacing
            params.tickLower = tickLower;
            params.tickUpper = tickUpper;
        }

        // if margin delta is positive, top up position margin

        if (params.marginDelta > 0 || msg.value > 0) {
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
        ) = vamm.swap(swapParams);
        _tickAfter = vamm.vammVars().tick;
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
