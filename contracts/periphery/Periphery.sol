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

    /// @dev Voltz Protocol marginEngine => LP Notional Cap in Underlying Tokens
    /// @dev LP notional cap of zero implies no notional cap
    /// @inheritdoc IPeriphery
    mapping(IMarginEngine => uint256) public override lpNotionalCaps;

    /// @dev amount of notional (coming from the periphery) in terms of underlying tokens taken up by LPs in a given MarginEngine
    /// @inheritdoc IPeriphery
    mapping(IMarginEngine => uint256) public override lpNotionalCumulatives;

    modifier marginEngineOwnerOnly(IMarginEngine _marginEngine) {
        require(address(_marginEngine) != address(0), "me addr zero");
        address marginEngineOwner = OwnableUpgradeable(address(_marginEngine))
            .owner();
        require(msg.sender == marginEngineOwner, "only me owner");
        _;
    }

    modifier checkLPNotionalCap(
        IMarginEngine _marginEngine,
        uint256 _notionalDelta,
        bool _isMint
    ) {
        uint256 _lpNotionalCap = lpNotionalCaps[_marginEngine];

        if (_isMint) {
            lpNotionalCumulatives[_marginEngine] += _notionalDelta;

            if (_lpNotionalCap > 0) {
                /// @dev if > 0 the cap assumed to have been set, if == 0 assume no cap by convention
                require(
                    lpNotionalCumulatives[_marginEngine] < _lpNotionalCap,
                    "lp cap limit"
                );
            }
        } else {
            lpNotionalCumulatives[_marginEngine] -= _notionalDelta;
        }

        _;
    }

    function setLPNotionalCap(
        IMarginEngine _marginEngine,
        uint256 _lpNotionalCapNew
    ) external marginEngineOwnerOnly(_marginEngine) {
        if (lpNotionalCaps[_marginEngine] != _lpNotionalCapNew) {
            lpNotionalCaps[_marginEngine] = _lpNotionalCapNew;
            emit NotionalCap(_marginEngine, lpNotionalCaps[_marginEngine]);
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
        checkLPNotionalCap(params.marginEngine, params.notional, params.isMint)
        returns (int256 positionMarginRequirement)
    {
        Tick.checkTicks(params.tickLower, params.tickUpper);

        IVAMM vamm = params.marginEngine.vamm();

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

    function estimatedCashflowAtMaturity(
        IMarginEngine marginEngine,
        address _owner,
        int24 _tickLower,
        int24 _tickUpper
    ) external override returns (int256 estimatedSettlementCashflow) {
        uint256 historicalAPYWad = marginEngine.getHistoricalApy();

        uint256 termStartTimestampWad = marginEngine.termStartTimestampWad();
        uint256 termEndTimestampWad = marginEngine.termEndTimestampWad();

        uint256 termInYears = FixedAndVariableMath.accrualFact(
            termEndTimestampWad - termStartTimestampWad
        );

        // calculate the estimated variable factor from start to maturity
        uint256 _estimatedVariableFactorFromStartToMaturity = PRBMathUD60x18
            .pow((PRBMathUD60x18.fromUint(1) + historicalAPYWad), termInYears) -
            PRBMathUD60x18.fromUint(1);

        Position.Info memory position = marginEngine.getPosition(
            _owner,
            _tickLower,
            _tickUpper
        );

        estimatedSettlementCashflow = FixedAndVariableMath
            .calculateSettlementCashflow(
                position.fixedTokenBalance,
                position.variableTokenBalance,
                termStartTimestampWad,
                termEndTimestampWad,
                _estimatedVariableFactorFromStartToMaturity
            );
    }
}
