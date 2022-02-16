// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/MarginCalculator.sol";
import "./utils/SafeCast.sol";
import "./utils/Printer.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFCM.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@rari-capital/solmate/src/utils/SafeTransferLib.sol";

contract MarginEngine is IMarginEngine, Initializable, OwnableUpgradeable, PausableUpgradeable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);

    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    using SafeTransferLib for IERC20Minimal;

    /// @dev liquidatorReward (in wei) is the percentage of the margin (of a liquidated trader/liquidity provider) that is sent to the liquidator
    /// @dev following a successful liquidation that results in a trader/position unwind, example value:  2 * 10**15;
    uint256 public override liquidatorRewardWad;
    /// @inheritdoc IMarginEngine
    address public override underlyingToken;
    /// @inheritdoc IMarginEngine
    uint256 public override termStartTimestampWad;
    /// @inheritdoc IMarginEngine
    uint256 public override termEndTimestampWad;

    IFCM public override fcm; // full collateralisation module

    mapping(bytes32 => Position.Info) internal positions;
    IVAMM public override vamm;

    MarginCalculatorParameters internal marginCalculatorParameters;

    /// @inheritdoc IMarginEngine
    uint256 public override secondsAgo;

    uint256 internal cachedHistoricalApy;
    uint256 private cachedHistoricalApyRefreshTimestamp;

    uint256 public cacheMaxAgeInSeconds;

    address private deployer;

    IFactory public override factory;

    bool public isInsuranceDepleted;

    IRateOracle public override rateOracle;

    // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {

        deployer = msg.sender; /// this is presumably the factory

    }

    function initialize(address _underlyingToken, address _rateOracleAddress, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad) external override initializer {
        require(_underlyingToken != address(0), "UT must be set");
        require(_rateOracleAddress != address(0), "RO must be set");
        require(_termStartTimestampWad != 0, "TS must be set");
        require(_termEndTimestampWad != 0, "TE must be set");

        underlyingToken = _underlyingToken;
        termStartTimestampWad = _termStartTimestampWad;
        termEndTimestampWad = _termEndTimestampWad;

        rateOracle = IRateOracle(_rateOracleAddress);
        factory = IFactory(msg.sender);

        __Ownable_init();
        __Pausable_init();
    }

    /// Only the position/trade owner can update the LP/Trader margin
    error OnlyOwnerCanUpdatePosition();

    error OnlyVAMM();

    error OnlyFCM();

    /// Margin delta must not equal zero
    error InvalidMarginDelta();

    /// Positions and Traders cannot be settled before the applicable interest rate swap has matured
    error CannotSettleBeforeMaturity();

    /// The position/trader needs to be below the liquidation threshold to be liquidated
    error CannotLiquidate();

    /// The resulting margin does not meet minimum requirements
    error MarginRequirementNotMet();

    modifier nonZeroDelta (int256 marginDelta) {
        if (marginDelta == 0) {
            revert InvalidMarginDelta();
        }
        _;
    }

    modifier onlyVAMM () {
        if (msg.sender != address(vamm)) {
            revert OnlyVAMM();
        }
        _;
    }

    modifier onlyFCM () {
        if (msg.sender != address(fcm)) {
            revert OnlyFCM();
        }
        _;
    }
    
    modifier onlyAfterMaturity () {
        if (termEndTimestampWad > Time.blockTimestampScaled()) {
            revert CannotSettleBeforeMaturity();
        }
        _;
    }

    /// @dev Modifier that ensures new LP positions cannot be minted after one day before the maturity of the vamm
    /// @dev also ensures new swaps cannot be conducted after one day before maturity of the vamm
    modifier checkCurrentTimestampTermEndTimestampDelta() {
        if (Time.isCloseToMaturityOrBeyondMaturity(termEndTimestampWad)) {
        revert("closeToOrBeyondMaturity");
        }
        _;
    }

    /// @notice Set the per-oracle MarginCalculatorParameters
    /// @param _marginCalculatorParameters the MarginCalculatorParameters to set
    function setMarginCalculatorParameters(
        MarginCalculatorParameters memory _marginCalculatorParameters
    ) external override onlyOwner {
        marginCalculatorParameters = _marginCalculatorParameters;
    }

    function setVAMM(address _vAMMAddress) external override onlyOwner {
        vamm = IVAMM(_vAMMAddress);
    }

    function setFCM(address _fcm) external override onlyOwner {
        fcm = IFCM(_fcm);
    }

    /// @inheritdoc IMarginEngine
    function setSecondsAgo(uint256 _secondsAgo)
        external
        override
        onlyOwner
    {
        secondsAgo = _secondsAgo;
        emit HistoricalApyWindowSet(Time.blockTimestampScaled(), address(this), secondsAgo);
    }

    /// @notice Sets the maximum age that the cached historical APY value
    /// @param _cacheMaxAgeInSeconds The new maximum age that the historical APY cache can be before being considered stale
    function setCacheMaxAgeInSeconds(uint256 _cacheMaxAgeInSeconds)
        external
        onlyOwner
    {
        cacheMaxAgeInSeconds = _cacheMaxAgeInSeconds;
        emit CacheMaxAgeSet(Time.blockTimestampScaled(), address(this), cacheMaxAgeInSeconds);
    }

    function setIsInsuranceDepleted(bool _isInsuranceDepleted) external override onlyOwner {
        isInsuranceDepleted = _isInsuranceDepleted;
        emit IsInsuranceDepletedSet(Time.blockTimestampScaled(), address(this), isInsuranceDepleted);
    }

    function collectProtocol(address recipient, uint256 amount)
        external
        override
        onlyOwner{

        if (amount > 0) {
            /// @dev if the amount exceeds the available balances, vamm.updateProtocolFees(amount) should be reverted as intended
            vamm.updateProtocolFees(amount);
            IERC20Minimal(underlyingToken).transfer(
                recipient,
                amount
            );
        }

        emit CollectProtocol(Time.blockTimestampScaled(), address(this), recipient, amount);
    }

    function setLiquidatorReward(uint256 _liquidatorRewardWad) external override onlyOwner {
        liquidatorRewardWad = _liquidatorRewardWad;
        emit LiquidatorRewardSet(Time.blockTimestampScaled(), address(this), liquidatorRewardWad);
    }

    /// @inheritdoc IMarginEngine
    function getPosition(address _owner,
                         int24 tickLower,
                         int24 tickUpper)
        external override view returns (Position.Info memory position) {
            return positions.get(_owner, tickLower, tickUpper);
    }

    /// @dev Transfers funds in from account if _marginDelta is positive, or out to account if _marginDelta is negative
    function transferMargin(address _account, int256 _marginDelta) internal {
        if (_marginDelta > 0) {
            IERC20Minimal(underlyingToken).transferFrom(_account, address(this), uint256(_marginDelta));
        } else {
            uint256 marginEngineBalance = IERC20Minimal(underlyingToken).balanceOf(address(this));

            if (uint256(-_marginDelta) > marginEngineBalance) {
                uint256 remainingDeltaToCover = uint256(-_marginDelta);
                if (marginEngineBalance > 0) {
                    remainingDeltaToCover = remainingDeltaToCover - marginEngineBalance;
                    IERC20Minimal(underlyingToken).safeTransfer(_account, marginEngineBalance);
                }
                fcm.transferMarginToMarginEngineTrader(_account, remainingDeltaToCover);
            } else {
                IERC20Minimal(underlyingToken).transfer(_account, uint256(-_marginDelta));
            }

        }
    }

    function transferMarginToFCMTrader(address _account, uint256 marginDelta) external onlyFCM override {
        IERC20Minimal(underlyingToken).transfer(_account, marginDelta);
    }


    function updatePositionMargin(address _owner, int24 tickLower, int24 tickUpper, int256 marginDelta) external nonZeroDelta(marginDelta) override {
        
        Tick.checkTicks(tickLower, tickUpper);
        
        Position.Info storage position = positions.get(_owner, tickLower, tickUpper);
        
        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);

        require((position.margin + marginDelta) >= 0, "can't withdraw more than have");
        
        if (marginDelta < 0) {

            if (_owner != msg.sender || factory.isApproved(_owner, msg.sender)) {
                revert OnlyOwnerCanUpdatePosition();
            }

            position.updateMarginViaDelta(marginDelta);

            checkPositionMarginCanBeUpdated(position, tickLower, tickUpper); 

            emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);

            transferMargin(_owner, marginDelta);

        } else {

            position.updateMarginViaDelta(marginDelta);
            emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);

            address depositor;
            if (factory.isApproved(_owner, msg.sender)) {
                depositor = _owner;
            } else {
                depositor = msg.sender;
            }

            transferMargin(depositor, marginDelta);
        }

    }
    
    
    /// @inheritdoc IMarginEngine
    function settlePosition(int24 tickLower, int24 tickUpper, address _owner) external override whenNotPaused onlyAfterMaturity {
        
        Tick.checkTicks(tickLower, tickUpper);

        Position.Info storage position = positions.get(_owner, tickLower, tickUpper); 
            
        require(!position.isSettled, "already settled");
        
        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);
        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestampWad, termEndTimestampWad, rateOracle.variableFactor(termStartTimestampWad, termEndTimestampWad));

        
        if (position._liquidity>0) {    
            Printer.printInt256("LP position.fixedTokenBalance", position.fixedTokenBalance);
            Printer.printInt256("LP position.variableTokenBalance", position.variableTokenBalance);
            Printer.printInt256("LP settlementCashflow", settlementCashflow);
        } else {
            Printer.printInt256("Trader position.fixedTokenBalance", position.fixedTokenBalance);
            Printer.printInt256("Trader position.variableTokenBalance", position.variableTokenBalance);
            Printer.printInt256("Trader settlementCashflow", settlementCashflow);
        }

        position.updateBalancesViaDeltas(-position.fixedTokenBalance, -position.variableTokenBalance);
        emit BalancesViaDeltasUpdate(
            Time.blockTimestampScaled(),
            address(this),
            -position.fixedTokenBalance,
            -position.variableTokenBalance
        );
        position.updateMarginViaDelta(settlementCashflow);
        emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);
        position.settlePosition();
        emit SettlePosition(Time.blockTimestampScaled(), address(this), position);
    }
    
    /// @notice Computes the historical APY value of the RateOracle
    /// @dev The lookback window used by this function is determined by the secondsAgo state variable
    function getHistoricalApy()
        public
        returns (uint256)
    {
        if (cachedHistoricalApyRefreshTimestamp < block.timestamp - cacheMaxAgeInSeconds) {
            // Cache is stale
            _refreshHistoricalApyCache();
        }
        return cachedHistoricalApy;
    }

    /// @notice Computes the historical APY value of the RateOracle
    /// @dev The lookback window used by this function is determined by the secondsAgo state variable
    function getHistoricalApyReadOnly()
        public
        view
        returns (uint256)
    {
        if (cachedHistoricalApyRefreshTimestamp < block.timestamp - cacheMaxAgeInSeconds) {
            // Cache is stale
            return _getHistoricalApy();
        }
        return cachedHistoricalApy;
    }

    /// @notice Computes the historical APY value of the RateOracle
    /// @dev The lookback window used by this function is determined by the secondsAgo state variable
    function _getHistoricalApy()
        internal
        view
        returns (uint256)
    {
        uint256 to = block.timestamp;
        uint256 from = to - secondsAgo;

        return rateOracle.getApyFromTo(from, to);
    }

    /// @notice Updates the cached historical APY value of the RateOracle even if the cache is not stale
    function _refreshHistoricalApyCache()
        internal
    {
        cachedHistoricalApy = _getHistoricalApy();
        cachedHistoricalApyRefreshTimestamp = block.timestamp;
    }


    /// @inheritdoc IMarginEngine
    function liquidatePosition(int24 tickLower, int24 tickUpper, address _owner) external checkCurrentTimestampTermEndTimestampDelta override {

        /// @dev can only happen before maturity, this is checked when an unwind is triggered which in turn triggers a swap which checks for this condition

        Tick.checkTicks(tickLower,tickUpper);

        Position.Info storage position = positions.get(_owner, tickLower, tickUpper);  

        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);
        
        bool isLiquidatable = isLiquidatablePosition(position, tickLower, tickUpper);

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        uint256 liquidatorRewardValueWad = PRBMathUD60x18.mul(PRBMathUD60x18.fromUint(uint256(position.margin)), liquidatorRewardWad);

        uint256 liquidatorRewardValue = PRBMathUD60x18.toUint(liquidatorRewardValueWad);

        position.updateMarginViaDelta(-int256(liquidatorRewardValue));
        emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);

        if (position._liquidity > 0) {
            /// @dev pass position._liquidity to ensure all of the liqudity is burnt
            vamm.burn(_owner, tickLower, tickUpper, position._liquidity);
        }
    
        unwindPosition(position, _owner, tickLower, tickUpper);

        IERC20Minimal(underlyingToken).transfer(msg.sender, liquidatorRewardValue);

    }


    /// @inheritdoc IMarginEngine
    function updatePositionPostVAMMInducedMintBurn(IVAMM.ModifyPositionParams memory params) external onlyVAMM override {

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);

        updatePositionTokenBalancesAndAccountForFees(position, params.tickLower, params.tickUpper, true);

        position.updateLiquidity(params.liquidityDelta);
        emit LiquidityUpdate(Time.blockTimestampScaled(), address(this), position, position._liquidity);

        if (params.liquidityDelta>0) {
            checkPositionMarginAboveRequirement(position, params.tickLower, params.tickUpper);
        }

    }

    function updatePositionPostVAMMInducedSwap(address _owner, int24 tickLower, int24 tickUpper, int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred) external onlyVAMM override {
        /// @dev this function can only be called by the vamm following a swap    

        Position.Info storage position = positions.get(_owner, tickLower, tickUpper);
        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);

        if (cumulativeFeeIncurred > 0) {
            position.updateMarginViaDelta(-int256(cumulativeFeeIncurred));
            emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);
        }

        position.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);
        emit BalancesViaDeltasUpdate(
            Time.blockTimestampScaled(),
            address(this),
            position.fixedTokenBalance,
            position.variableTokenBalance
        );

        int256 positionMarginRequirement = int256(
            getPositionMarginRequirement(position, tickLower, tickUpper, false)
        );

        if (positionMarginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }

    }
    

    function updatePositionTokenBalancesAndAccountForFees(
        Position.Info storage position,
        int24 tickLower,
        int24 tickUpper,
        bool isMintBurn
        ) internal {

        if (position._liquidity > 0) {
            (int256 fixedTokenGrowthInsideX128, int256 variableTokenGrowthInsideX128, uint256 feeGrowthInsideX128) = vamm.computeGrowthInside(tickLower, tickUpper);
            (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
            uint256 feeDelta = position.calculateFeeDelta(feeGrowthInsideX128);

            position.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);
            emit BalancesViaDeltasUpdate(
                Time.blockTimestampScaled(),
                address(this),
                position.fixedTokenBalance,
                position.variableTokenBalance
            );
            position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
            emit FixedAndVariableTokenGrowthInsideUpdate(
                Time.blockTimestampScaled(),
                address(this),
                position,
                fixedTokenGrowthInsideX128,
                variableTokenGrowthInsideX128
            );
            /// @dev collect fees
            position.updateMarginViaDelta(int256(feeDelta));
            emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);
            position.updateFeeGrowthInside(feeGrowthInsideX128);
            emit FeeGrowthInsideUpdate(Time.blockTimestampScaled(), address(this), position, feeGrowthInsideX128);

            emit PositionTokenBalancesAndAccountForFeesUpdate(Time.blockTimestampScaled(), address(this), position, position.fixedTokenBalance, position.variableTokenBalance, feeDelta);
        } else {
            if (isMintBurn) {
                (int256 fixedTokenGrowthInsideX128, int256 variableTokenGrowthInsideX128, uint256 feeGrowthInsideX128) = vamm.computeGrowthInside(tickLower, tickUpper);
                position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
                position.updateFeeGrowthInside(feeGrowthInsideX128);
            }
        }
    }
    

    function checkPositionMarginAboveRequirement(
        Position.Info storage position,
        int24 tickLower,
        int24 tickUpper
    ) internal {
    
        int256 positionMarginRequirement = int256(
            getPositionMarginRequirement(position, tickLower, tickUpper, false)
        );

        if (position.margin <= positionMarginRequirement) {
            revert MarginLessThanMinimum();
        }
    }


    function checkPositionMarginCanBeUpdated(
        Position.Info storage position,
        int24 tickLower,
        int24 tickUpper
    ) internal {

        /// @dev If the IRS AMM has reached maturity, the only reason why someone would want to update
        /// @dev their margin is to withdraw it completely. If so, the position needs to be settled

        if (Time.blockTimestampScaled() >= termEndTimestampWad) {
            if (!position.isSettled) {
                revert PositionNotSettled();
            }
            if (position.margin < 0) {
                revert WithdrawalExceedsCurrentMargin();
            }
        }
        else {
            checkPositionMarginAboveRequirement(
                position,
                tickLower,
                tickUpper
            );
        }
    }

    
    /// @notice Unwind a position
    /// @dev Before unwinding a position, need to check if it is even necessary to unwind it, i.e. check if the most up to date variable token balance of a position is non-zero
    /// @dev If the current fixed token balance of a position is positive, this implies the position is a net Fixed Taker,
    /// @dev Hence to unwind need to enter into a Variable Taker IRS contract with notional = abs(current variable token balance)
    /// @param _owner the owner of the position
    /// @param tickLower the lower tick of the position's tick range
    /// @param tickUpper the upper tick of the position's tick range
    function unwindPosition(
        Position.Info storage position,
        address _owner,
        int24 tickLower,
        int24 tickUpper
    ) internal {

        Tick.checkTicks(tickLower, tickUpper);

        if (position.variableTokenBalance != 0 ) {

            int256 _fixedTokenDelta;
            int256 _variableTokenDelta;
            uint256 _cumulativeFeeIncurred;

            /// @dev initiate a swap

            bool isFT = position.variableTokenBalance < 0;

            if (isFT) {

                /// @dev get into a Variable Taker swap (the opposite of LP's current position) --> hence isFT is set to false
                /// @dev amountSpecified needs to be negative
                /// @dev since the position.variableTokenBalance is already negative, pass position.variableTokenBalance as amountSpecified
                /// @dev since moving from left to right along the virtual amm, sqrtPriceLimit is set to MIN_SQRT_RATIO

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: _owner,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO + 1,
                    isExternal: true,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });

                // check the outputs are correct
                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = vamm.swap(params);
            } else {

                /// @dev get into a Fixed Taker swap (the opposite of LP's current position), hence isFT is set to true in SwapParams
                /// @dev amountSpecified needs to be positive
                /// @dev since the position.variableTokenBalance is already positive, pass position.variableTokenBalance as amountSpecified
                /// @dev since moving from right to left along the virtual amm, sqrtPriceLimit is set to MAX_SQRT_RATIO

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: _owner,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO - 1,
                    isExternal: true,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = vamm.swap(params);
            }

            if (_cumulativeFeeIncurred > 0) {
                /// @dev update position margin to account for the fees incurred while conducting a swap in order to unwind
                position.updateMarginViaDelta(-int256(_cumulativeFeeIncurred));
                emit MarginViaDeltaUpdate(Time.blockTimestampScaled(), address(this), position, position.margin);
            }

            /// @dev passes the _fixedTokenBalance and _variableTokenBalance deltas
            position.updateBalancesViaDeltas(_fixedTokenDelta, _variableTokenDelta);
            emit BalancesViaDeltasUpdate(
                Time.blockTimestampScaled(),
                address(this),
                position.fixedTokenBalance,
                position.variableTokenBalance
            );

        }

    }

    function getPositionMarginRequirement(
        Position.Info storage position,
        int24 tickLower,
        int24 tickUpper,
        bool isLM
    ) internal returns (uint256 margin) {
        Tick.checkTicks(tickLower, tickUpper);

        (uint160 sqrtPriceX96, int24 tick, ) = vamm.vammVars();

        uint256 variableFactorWad = rateOracle.variableFactor(termStartTimestampWad, termEndTimestampWad);

        if (position._liquidity > 0) {
            /// simplify (2 scenarios from current to lower, from  current to upper)?

            PositionMarginRequirementLocalVars memory localVars;

            if (tick < tickLower) {
                /// @dev scenario 1: a trader comes in and trades all the liqudiity all the way to tickUpper given current liqudity of the LP
                /// @dev scenario 2: current tick never reaches the tickLower (LP stays with their current fixed and variable token balances)

                /// @dev from the perspective of the LP (not the trader who is a Fixed Taker)
                /// @dev Scenario 1

                /// @dev this value is negative since the LP is a Variable Taker in this case
                localVars.amount0FromTickLowerToTickUpper = SqrtPriceMath
                    .getAmount0Delta(
                        TickMath.getSqrtRatioAtTick(tickLower),
                        TickMath.getSqrtRatioAtTick(tickUpper),
                        -int128(position._liquidity)
                    );

                /// @dev this value is positive since the LP is a Variable Taker in this case
                localVars.amount1FromTickLowerToTickUpper = SqrtPriceMath
                    .getAmount1Delta(
                        TickMath.getSqrtRatioAtTick(tickLower),
                        TickMath.getSqrtRatioAtTick(tickUpper),
                        int128(position._liquidity)
                    );

                localVars.scenario1LPVariableTokenBalance =
                    position.variableTokenBalance +
                    localVars.amount1FromTickLowerToTickUpper;

                localVars.scenario1LPFixedTokenBalance =
                    position.fixedTokenBalance +
                    FixedAndVariableMath.getFixedTokenBalance(
                        localVars.amount0FromTickLowerToTickUpper,
                        localVars.amount1FromTickLowerToTickUpper,
                        variableFactorWad,
                        termStartTimestampWad,
                        termEndTimestampWad
                    );

                /// @dev Scenario 2
                localVars.scenario2LPVariableTokenBalance = position.variableTokenBalance;
                localVars.scenario2LPFixedTokenBalance = position.fixedTokenBalance;
            } else if (tick < tickUpper) {
                /// @dev scenario 1: a trader comes in and trades all the liquidity from currentTick to tickUpper given current liquidity of LP
                /// @dev scenario 2: a trader comes in and trades all the liquidity from currentTick to tickLower given current liquidity of LP

                /// @dev from the perspective of the LP (not the trader who is a Fixed Taker)
                /// @dev Scenario 1

                /// @dev this value is negative since the LP is a Variable Taker in this case
                localVars.amount0FromCurrentTickToTickUpper = SqrtPriceMath
                    .getAmount0Delta(
                        TickMath.getSqrtRatioAtTick(tick),
                        TickMath.getSqrtRatioAtTick(tickUpper),
                        -int128(position._liquidity)
                    );

                /// @dev this value is positive since the LP is a Variable Taker in this case
                localVars.amount1FromCurrentTickToTickUpper = SqrtPriceMath
                    .getAmount1Delta(
                        TickMath.getSqrtRatioAtTick(tick),
                        TickMath.getSqrtRatioAtTick(tickUpper),
                        int128(position._liquidity)
                    );

                localVars.scenario1LPVariableTokenBalance =
                    position.variableTokenBalance +
                    localVars.amount1FromCurrentTickToTickUpper;
                localVars.scenario1LPFixedTokenBalance =
                    position.fixedTokenBalance +
                    FixedAndVariableMath.getFixedTokenBalance(
                        localVars.amount0FromCurrentTickToTickUpper,
                        localVars.amount1FromCurrentTickToTickUpper,
                        variableFactorWad,
                        termStartTimestampWad,
                        termEndTimestampWad
                    );

                /// @dev from the perspective of the LP (not the trader who is a Variable Taker)
                /// @dev Scenario 2

                /// @dev this value is positive since the LP is a Fixed Taker in this case
                localVars.amount0FromCurrentTickToTickLower = SqrtPriceMath
                    .getAmount0Delta(
                        TickMath.getSqrtRatioAtTick(tick),
                        TickMath.getSqrtRatioAtTick(tickLower),
                        int128(position._liquidity)
                    );

                /// @dev this value is negative since the LP is a FixedTaker in this case
                localVars.amount1FromCurrentTickToTickLower = SqrtPriceMath
                    .getAmount1Delta(
                        TickMath.getSqrtRatioAtTick(tick),
                        TickMath.getSqrtRatioAtTick(tickLower),
                        -int128(position._liquidity)
                    );

                localVars.scenario2LPVariableTokenBalance =
                    position.variableTokenBalance +
                    localVars.amount1FromCurrentTickToTickLower;
                localVars.scenario2LPFixedTokenBalance =
                    position.fixedTokenBalance +
                    FixedAndVariableMath.getFixedTokenBalance(
                        localVars.amount0FromCurrentTickToTickLower,
                        localVars.amount1FromCurrentTickToTickLower,
                        variableFactorWad,
                        termStartTimestampWad,
                        termEndTimestampWad
                    );
            } else {
                /// @dev scenario 1: a trader comes in and trades all the liqudiity all the way to tickLower given current liqudity of the LP
                /// @dev scenario 2: current tick never reaches the tickUpper (LP stays with their current fixed and variable token balances)

                /// @dev from the perspective of the LP (not the trader who is a Variable Taker)
                /// @dev Scenario 1

                /// @dev this value is positive since the LP is a Fixed Taker in this case
                localVars.amount0FromTickUpperToTickLower = SqrtPriceMath
                    .getAmount0Delta(
                        TickMath.getSqrtRatioAtTick(tickUpper),
                        TickMath.getSqrtRatioAtTick(tickLower),
                        int128(position._liquidity)
                    );

                /// @dev this value is negative since the LP is a Fixed Taker in this case
                localVars.amount1FromTickUpperToTickLower = SqrtPriceMath
                    .getAmount1Delta(
                        TickMath.getSqrtRatioAtTick(tickUpper),
                        TickMath.getSqrtRatioAtTick(tickLower),
                        -int128(position._liquidity)
                    );

                localVars.scenario1LPVariableTokenBalance =
                    position.variableTokenBalance +
                    localVars.amount1FromTickUpperToTickLower;
                localVars.scenario1LPFixedTokenBalance =
                    position.fixedTokenBalance +
                    FixedAndVariableMath.getFixedTokenBalance(
                        localVars.amount0FromTickUpperToTickLower,
                        localVars.amount1FromTickUpperToTickLower,
                        variableFactorWad,
                        termStartTimestampWad,
                        termEndTimestampWad
                    );

                /// @dev Scenario 2
                localVars.scenario2LPVariableTokenBalance = position.variableTokenBalance;
                localVars.scenario2LPFixedTokenBalance = position.fixedTokenBalance;
            }

            if (localVars.scenario1LPVariableTokenBalance > 0) {
                // will engage in a (counterfactual) fixed taker unwind for minimum margin requirement
                localVars.scenario1SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                    tickUpper
                );
                if (localVars.scenario1SqrtPriceX96 < sqrtPriceX96) {
                    localVars.scenario1SqrtPriceX96 = sqrtPriceX96;
                }
            } else {
                // will engage in a (counterfactual) variable taker unwind for minimum margin requirement
                localVars.scenario1SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                    tickLower
                );
                if (localVars.scenario1SqrtPriceX96 > sqrtPriceX96) {
                    localVars.scenario1SqrtPriceX96 = sqrtPriceX96;
                }
            }

            if (localVars.scenario2LPVariableTokenBalance > 0) {
                // will engage in a (counterfactual) fixed taker unwind for minimum margin requirement
                localVars.scenario2SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                    tickUpper
                );

                if (localVars.scenario2SqrtPriceX96 < sqrtPriceX96) {
                    localVars.scenario2SqrtPriceX96 = sqrtPriceX96;
                }
            } else {
                // will engage in a (counterfactual) variable taker unwind for minimum margin requirement
                localVars.scenario2SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                    tickLower
                );

                if (localVars.scenario2SqrtPriceX96 > sqrtPriceX96) {
                    // this should theoretically never be the case
                    localVars.scenario2SqrtPriceX96 = sqrtPriceX96;
                }
            }

            localVars.scenario1MarginRequirement = getTraderMarginRequirement(localVars.scenario1LPFixedTokenBalance, localVars.scenario1LPVariableTokenBalance, isLM, localVars.scenario1SqrtPriceX96);
            localVars.scenario2MarginRequirement = getTraderMarginRequirement(localVars.scenario2LPFixedTokenBalance, localVars.scenario2LPVariableTokenBalance, isLM, localVars.scenario2SqrtPriceX96);

            if (localVars.scenario1MarginRequirement > localVars.scenario2MarginRequirement) {
                return localVars.scenario1MarginRequirement;
            } else {
                return localVars.scenario2MarginRequirement;
            }

        } else {
            // directly get the trader margin requirement
            return getTraderMarginRequirement(position.fixedTokenBalance, position.variableTokenBalance, isLM, sqrtPriceX96);
        }
        
    }

    /// @notice Checks if a given position is liquidatable
    /// @dev In order for a position to be liquidatable its current margin needs to be lower than the position's liquidation margin requirement
    /// @return _isLiquidatable A boolean which suggests if a given position is liquidatable
    function isLiquidatablePosition(
        Position.Info storage position,
        int24 tickLower,
        int24 tickUpper
    ) internal returns (bool _isLiquidatable) {
        uint256 marginRequirement = getPositionMarginRequirement(
            position,
            tickLower,
            tickUpper,
            true
        );
        if (position.margin < int256(marginRequirement)) {
            _isLiquidatable = true;
        } else {
            _isLiquidatable = false;
        }
    }


    /// @notice Returns either the Liquidation or Initial Margin Requirement of a given trader
    /// @return margin Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens
    function getTraderMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isLM,
        uint160 sqrtPriceX96
    ) internal returns (uint256 margin) {    
        margin = _getTraderMarginRequirement(
            fixedTokenBalance,
            variableTokenBalance,
            isLM
        );

        uint256 minimumMarginRequirement = getMinimumMarginRequirement(
            fixedTokenBalance,
            variableTokenBalance,
            isLM,
            sqrtPriceX96
        );

        if (margin < minimumMarginRequirement) {
            margin = minimumMarginRequirement;
        }
    }

    function _getTraderMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isLM
    ) internal returns (uint256 margin) {
    
        if (fixedTokenBalance >= 0 && variableTokenBalance >= 0) {
            return 0;
        }

        int256 fixedTokenBalanceWad = PRBMathSD59x18.fromInt(
            fixedTokenBalance
        );
        int256 variableTokenBalanceWad = PRBMathSD59x18.fromInt(
            variableTokenBalance
        );

        uint256 timeInSecondsFromStartToMaturityWad = termEndTimestampWad - termStartTimestampWad;

        int256 exp1Wad = PRBMathSD59x18.mul(
            fixedTokenBalanceWad,
            int256(
                FixedAndVariableMath.fixedFactor(
                    true,
                    termStartTimestampWad,
                    termEndTimestampWad
                )
            )
        );

        int256 exp2Wad = PRBMathSD59x18.mul(
            variableTokenBalanceWad,
            int256(
                MarginCalculator.worstCaseVariableFactorAtMaturity(
                    timeInSecondsFromStartToMaturityWad,
                    termEndTimestampWad,
                    Time.blockTimestampScaled(),
                    variableTokenBalance < 0,
                    isLM,
                    getHistoricalApy(),
                    marginCalculatorParameters
                )
            )
        );

        int256 maxCashflowDeltaToCoverPostMaturity = exp1Wad + exp2Wad;

        if (maxCashflowDeltaToCoverPostMaturity < 0) {
            margin = PRBMathUD60x18.toUint(
                uint256(-maxCashflowDeltaToCoverPostMaturity)
            );
        } else {
            margin = 0;
        }
    }

    function getMinimumMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isLM,
        uint160 sqrtPriceX96
    ) internal returns (uint256 margin) {
        
        if (variableTokenBalance == 0) {
            // if the variable token balance is zero there is no need for a minimum liquidator incentive since a liquidtion is not expected
            return 0;
        }

        int256 fixedTokenDeltaUnbalanced;
        uint256 devMulWad;
        uint256 fixedRateDeviationMinWad;

        if (variableTokenBalance > 0) {
            if (fixedTokenBalance > 0) {
                // if both are positive, no need to have a margin requirement
                return 0;
            }

            if (isLM) {
                devMulWad = marginCalculatorParameters.devMulLeftUnwindLMWad;
                fixedRateDeviationMinWad = marginCalculatorParameters
                    .fixedRateDeviationMinLeftUnwindLMWad;
            } else {
                devMulWad = marginCalculatorParameters.devMulLeftUnwindIMWad;
                fixedRateDeviationMinWad = marginCalculatorParameters
                    .fixedRateDeviationMinLeftUnwindIMWad;
            }

            // simulate an adversarial unwind (cumulative position is a VT --> simulate FT unwind --> movement to the left along the VAMM)
            fixedTokenDeltaUnbalanced = int256(
                MarginCalculator.getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(
                    uint256(variableTokenBalance),
                    sqrtPriceX96,
                    devMulWad,
                    fixedRateDeviationMinWad,
                    termEndTimestampWad,
                    Time.blockTimestampScaled(),
                    uint256(marginCalculatorParameters.tMaxWad),
                    marginCalculatorParameters.gammaWad,
                    true
                )
            );
        } else {
            if (isLM) {
                devMulWad = marginCalculatorParameters.devMulRightUnwindLMWad;
                fixedRateDeviationMinWad = marginCalculatorParameters
                    .fixedRateDeviationMinRightUnwindLMWad;
            } else {
                devMulWad = marginCalculatorParameters.devMulRightUnwindIMWad;
                fixedRateDeviationMinWad = marginCalculatorParameters
                    .fixedRateDeviationMinRightUnwindIMWad;
            }

            // simulate an adversarial unwind (cumulative position is an FT --> simulate a VT unwind --> movement to the right along the VAMM)
            fixedTokenDeltaUnbalanced = -int256(
                MarginCalculator.getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(
                    uint256(-variableTokenBalance),
                    sqrtPriceX96,
                    devMulWad,
                    fixedRateDeviationMinWad,
                    termEndTimestampWad,
                    Time.blockTimestampScaled(),
                    uint256(marginCalculatorParameters.tMaxWad),
                    marginCalculatorParameters.gammaWad,
                    false
                )
            );
        }

        int256 variableTokenDelta = -variableTokenBalance;

        int256 fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
            fixedTokenDeltaUnbalanced,
            variableTokenDelta,
            rateOracle.variableFactor(termStartTimestampWad, termEndTimestampWad),
            termStartTimestampWad,
            termEndTimestampWad
        );

        int256 updatedVariableTokenBalance = variableTokenBalance +
            variableTokenDelta; // should be zero
        int256 updatedFixedTokenBalance = fixedTokenBalance +
            fixedTokenDelta;

        margin = _getTraderMarginRequirement(
            updatedFixedTokenBalance,
            updatedVariableTokenBalance,
            isLM);

        if (
            margin <
            marginCalculatorParameters.minMarginToIncentiviseLiquidators
        ) {
            margin = marginCalculatorParameters
                .minMarginToIncentiviseLiquidators;
        }
    }


}