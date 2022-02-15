// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/MarginCalculator.sol";
import "./utils/SafeCast.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFCM.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MarginEngine is IMarginEngine, Initializable, OwnableUpgradeable, PausableUpgradeable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);
    
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    /// @dev liquidatorReward (in wei) is the percentage of the margin (of a liquidated trader/liquidity provider) that is sent to the liquidator 
    /// @dev following a successful liquidation that results in a trader/position unwind, example value:  2 * 10**15;
    uint256 public override liquidatorRewardWad;
    /// @inheritdoc IMarginEngine
    address public override underlyingToken;
    /// @inheritdoc IMarginEngine
    uint256 public override termStartTimestampWad;
    /// @inheritdoc IMarginEngine
    uint256 public override termEndTimestampWad;

    address public override fcm; // full collateralisation module

    mapping(bytes32 => Position.Info) internal positions;
    IVAMM public override vamm;

    MarginCalculatorParameters internal marginCalculatorParameters;

    /// @inheritdoc IMarginEngine
    uint256 public override secondsAgo;

    uint256 internal cachedHistoricalApy;
    uint256 private cachedHistoricalApyRefreshTimestamp;

    uint256 public cacheMaxAgeInSeconds;

    address private deployer;

    bool public isInsuranceDepleted;

    IRateOracle internal rateOracle;

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
        // rateOracleAddress = _rateOracleAddress;
        termStartTimestampWad = _termStartTimestampWad;
        termEndTimestampWad = _termEndTimestampWad;

        rateOracle = IRateOracle(rateOracleAddress);

        __Ownable_init();
        __Pausable_init();
    }

    /// Only the position/trade owner can update the LP/Trader margin
    error OnlyOwnerCanUpdatePosition();

    error OnlyVAMM();

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
        fcm = _fcm;
    }

    /// @inheritdoc IMarginEngine
    function setSecondsAgo(uint256 _secondsAgo)
        external
        override
        onlyOwner
    {
        secondsAgo = _secondsAgo;
        emit HistoricalApyWindowSet(_secondsAgo);
    }

    /// @notice Sets the maximum age that the cached historical APY value
    /// @param _cacheMaxAgeInSeconds The new maximum age that the historical APY cache can be before being considered stale
    function setCacheMaxAgeInSeconds(uint256 _cacheMaxAgeInSeconds)
        external
        onlyOwner
    {
        cacheMaxAgeInSeconds = _cacheMaxAgeInSeconds;
        emit CacheMaxAgeSet(_cacheMaxAgeInSeconds);
    }

    function setIsInsuranceDepleted(bool _isInsuranceDepleted) external override onlyOwner {
        isInsuranceDepleted = _isInsuranceDepleted;
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

        // emit collect protocol event
    }
    
    function setLiquidatorReward(uint256 _liquidatorRewardWad) external override onlyOwner {
        liquidatorRewardWad = _liquidatorRewardWad;
    }

    /// @inheritdoc IMarginEngine
    function getPosition(address owner,
                         int24 tickLower,
                         int24 tickUpper)
        external override view returns (Position.Info memory position) {
            return positions.get(owner, tickLower, tickUpper);
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
                    IERC20Minimal(underlyingToken).transfer(_account, marginEngineBalance);
                }
                IFCM(fcm).transferMarginToMarginEngineTrader(_account, remainingDeltaToCover);
            }

            IERC20Minimal(underlyingToken).transfer(_account, uint256(-_marginDelta));
        }
    }

    function transferMarginToFCMTrader(address _account, uint256 marginDelta) external override {
        /// @audit can only be called by the FCM
        IERC20Minimal(underlyingToken).transfer(_account, marginDelta);
    }


    /// @inheritdoc IMarginEngine
    function updatePositionMargin(address owner, int24 tickLower, int24 tickUpper, int256 marginDelta) external nonZeroDelta(marginDelta) override {
        
        Tick.checkTicks(tickLower, tickUpper);
        
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        
        if (position._liquidity > 0) {
            updatePositionTokenBalancesAndAccountForFees(position);
        }

        require((position.margin + marginDelta) >= 0, "can't withdraw more than have");
        
        if (marginDelta < 0) {

            if (owner != msg.sender) {
                revert OnlyOwnerCanUpdatePosition();
            }

            if (isInsuranceDepleted) {

                position.updateMarginViaDelta(marginDelta);

                transferMargin(msg.sender, marginDelta);

            } else {
            
                int256 updatedMarginWouldBe = position.margin + marginDelta;

                checkPositionMarginCanBeUpdated(position, updatedMarginWouldBe, tickLower, tickUpper, owner); 

                position.updateMarginViaDelta(marginDelta);

                transferMargin(msg.sender, marginDelta);
            }

        } else {

            position.updateMarginViaDelta(marginDelta);

            transferMargin(msg.sender, marginDelta);
        }
           
    }
    
    
    /// @inheritdoc IMarginEngine
    function settlePosition(ModifyPositionParams memory params) external override whenNotPaused onlyAfterMaturity {
        
        Tick.checkTicks(params.tickLower, params.tickUpper);

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper); 
            
        require(!position.isSettled, "already settled");
        
        updatePositionTokenBalancesAndAccountForFees(params.owner, params.tickLower, params.tickUpper);
        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestampWad, termEndTimestampWad, IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad));

        position.updateBalancesViaDeltas(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMarginViaDelta(settlementCashflow);
        position.settlePosition();
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

        return IRateOracle(rateOracleAddress).getApyFromTo(from, to);
    }

    /// @notice Updates the cached historical APY value of the RateOracle even if the cache is not stale 
    function _refreshHistoricalApyCache()
        internal
    {
        cachedHistoricalApy = _getHistoricalApy();
        cachedHistoricalApyRefreshTimestamp = block.timestamp;
    }
    
    
    /// @inheritdoc IMarginEngine
    function liquidatePosition(ModifyPositionParams memory params) external checkCurrentTimestampTermEndTimestampDelta override {

        /// @dev can only happen before maturity, this is checked when an unwind is triggered which in turn triggers a swap which checks for this condition

        Tick.checkTicks(params.tickLower, params.tickUpper);

        (uint160 sqrtPriceX96, int24 tick, ) = vamm.vammVars();
        updatePositionTokenBalancesAndAccountForFees(params.owner, params.tickLower, params.tickUpper);
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        bool isLiquidatable = MarginCalculator.isLiquidatablePosition(
            MarginCalculator.PositionMarginRequirementParams({
                owner: params.owner,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                isLM: true,
                currentTick: tick,
                termStartTimestampWad: termStartTimestampWad,
                termEndTimestampWad: termEndTimestampWad,
                liquidity: position._liquidity,
                fixedTokenBalance: position.fixedTokenBalance,
                variableTokenBalance: position.variableTokenBalance,
                variableFactorWad: IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad),
                historicalApyWad: getHistoricalApy(),
                sqrtPriceX96: sqrtPriceX96
            }),
            position.margin,
            marginCalculatorParameters
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        uint256 liquidatorRewardValueWad = PRBMathUD60x18.mul(PRBMathUD60x18.fromUint(uint256(position.margin)), liquidatorRewardWad);

        uint256 liquidatorRewardValue = PRBMathUD60x18.toUint(liquidatorRewardValueWad);

        position.updateMarginViaDelta(-int256(liquidatorRewardValue));

        /// @dev pass position._liquidity to ensure all of the liqudity is burnt

        vamm.burn(params.owner, params.tickLower, params.tickUpper, position._liquidity);

        /// @audit what if unwind fails, should ideally be a no-op
        unwindPosition(params.owner, params.tickLower, params.tickUpper);

        IERC20Minimal(underlyingToken).transfer(msg.sender, liquidatorRewardValue);
        
    }


    /// @inheritdoc IMarginEngine
    function updatePositionPostVAMMInducedMintBurn(IVAMM.ModifyPositionParams memory params) external onlyVAMM override {

        updatePositionTokenBalancesAndAccountForFees(params.owner, params.tickLower, params.tickUpper);
        /// @audit position is retreived from storage twice: once in the updatePositionTokenBalancesAndAccountForFees, once below

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);
        position.updateLiquidity(params.liquidityDelta);
        
        if (params.liquidityDelta>0) {
            uint256 variableFactorWad = IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad);
            checkPositionMarginAboveRequirement(params, position.margin, position._liquidity, position.fixedTokenBalance, position.variableTokenBalance, variableFactorWad);
        }

    }

    function updatePositionPostVAMMInducedSwap(address owner, int24 tickLower, int24 tickUpper, int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred, int24 currentTick, uint160 sqrtPriceX96) external onlyVAMM override {
        /// @dev this function can only be called by the vamm following a swap    

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        updatePositionTokenBalancesAndAccountForFees(owner, tickLower, tickUpper);

        if (cumulativeFeeIncurred > 0) {
            position.updateMarginViaDelta(-int256(cumulativeFeeIncurred));
        }

        position.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);

        uint256 variableFactorWad = IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad);
        
        MarginCalculator.PositionMarginRequirementParams
            memory marginReqParams = MarginCalculator
                .PositionMarginRequirementParams({
                    owner: owner,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    isLM: false,
                    currentTick: currentTick,
                    termStartTimestampWad: termStartTimestampWad,
                    termEndTimestampWad: termEndTimestampWad,
                    liquidity: position._liquidity,
                    fixedTokenBalance: position.fixedTokenBalance,
                    variableTokenBalance: position.variableTokenBalance,
                    variableFactorWad: variableFactorWad,
                    historicalApyWad: getHistoricalApy(),
                    sqrtPriceX96: sqrtPriceX96
                });

        int256 positionMarginRequirement = int256(
            MarginCalculator.getPositionMarginRequirement(marginReqParams, marginCalculatorParameters)
        );

        if (positionMarginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }

    }
    

    function updatePositionTokenBalancesAndAccountForFees(
        Position.Info storage position
        ) internal {
        (int256 fixedTokenGrowthInsideX128, int256 variableTokenGrowthInsideX128, uint256 feeGrowthInsideX128) = vamm.computeGrowthInside(tickLower, tickUpper);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
        uint256 feeDelta = position.calculateFeeDelta(feeGrowthInsideX128);

        position.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
        /// @dev collect fees
        position.updateMarginViaDelta(int256(feeDelta));
        position.updateFeeGrowthInside(feeGrowthInsideX128);
    
    }
    

    function checkPositionMarginAboveRequirement(
        Position.Info storage position,
        int256 updatedMarginWouldBe,
        int24 tickLower,
        int24 tickUpper,
        address owner
    ) internal {
    
        int256 positionMarginRequirement = int256(
            getPositionMarginRequirement(position, tickLower, tickUpper, owner, false)
        );

        if (updatedMarginWouldBe <= positionMarginRequirement) {
            revert MarginLessThanMinimum();
        }
    }


    /// @notice Check if the position margin can be updated
    /// @param params Position owner, position tickLower, position tickUpper, _
    /// @param updatedMarginWouldBe Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param positionLiquidity Current liquidity supplied by the position
    /// @param positionFixedTokenBalance Fixed token balance of a position since the last mint/burn/poke
    /// @param positionVariableTokenBalance Variable token balance of a position since the last mint/burn/poke
    /// @param variableFactorWad Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev If the current timestamp is higher than the maturity timestamp of the AMM, then the position needs to be burned (detailed definition above)
    function checkPositionMarginCanBeUpdated(
        Position.Info storage position,
        int256 updatedMarginWouldBe,
        int24 tickLower,
        int24 tickUpper,
        address owner
    ) internal {

        /// @dev If the IRS AMM has reached maturity, the only reason why someone would want to update
        /// @dev their margin is to withdraw it completely. If so, the position needs to be settled

        if (Time.blockTimestampScaled() >= termEndTimestampWad) {
            if (!isPositionSettled) {
                revert PositionNotSettled();
            }
            if (updatedMarginWouldBe < 0) {
                revert WithdrawalExceedsCurrentMargin();
            }
        }
        else {
            checkPositionMarginAboveRequirement(
                position,
                updatedMarginWouldBe,
                tickLower,
                tickUpper,
                owner
            );
        }
    }

    
    /// @notice Unwind a position
    /// @dev Auth:
    /// @dev Before unwinding a position, need to check if it is even necessary to unwind it, i.e. check if the most up to date variable token balance of a position is non-zero
    /// @dev If the current fixed token balance of a position is positive, this implies the position is a net Fixed Taker,
    /// @dev Hence to unwind need to enter into a Variable Taker IRS contract with notional = abs(current variable token balance)
    /// @param owner the owner of the position
    /// @param tickLower the lower tick of the position's tick range
    /// @param tickUpper the upper tick of the position's tick range
    function unwindPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) internal {
    
        /// @audit check if beyond maturity (done in the liquidation call)
        Tick.checkTicks(tickLower, tickUpper);

        /// @audit below is potentially redundunt since the burn already induces updates via updatePositionPostVAMMMintBurn, needs to be checked

        updatePositionTokenBalancesAndAccountForFees(owner, tickLower, tickUpper);

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

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
                    recipient: owner,
                    isFT: false,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO + 1,
                    isExternal: true,
                    isTrader: false,
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
                    recipient: owner,
                    isFT: true,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO - 1,
                    isExternal: true,
                    isTrader: false,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = vamm.swap(params);
            }

            if (_cumulativeFeeIncurred > 0) {
                /// @dev update position margin to account for the fees incurred while conducting a swap in order to unwind
                position.updateMarginViaDelta(-int256(_cumulativeFeeIncurred));
            }
            
            /// @dev passes the _fixedTokenBalance and _variableTokenBalance deltas
            position.updateBalancesViaDeltas(_fixedTokenDelta, _variableTokenDelta);

        }
        
    }

    function getPositionMarginRequirement(
        Position.Info storage position,
        int24 tickLower,
        int24 tickUpper,
        address owner,
        bool isLM
    ) internal view returns (uint256 margin) {
        Tick.checkTicks(tickLower, tickUpper);
        
        // update fees and balances

        (uint160 sqrtPriceX96, int24 tick, ) = vamm.vammVars();

        uint256 variableFactorWad = rateOracle.variableFactor(termStartTimestampWad, termEndTimestampWad);

        if (position.liquidity > 0) {

             int256 scenario1LPVariableTokenBalance;
        int256 scenario1LPFixedTokenBalance;

        int256 scenario2LPVariableTokenBalance;
        int256 scenario2LPFixedTokenBalance;

        /// @audit simplify (2 scenarios from current to lower, from  current to upper)

        if (params.currentTick < params.tickLower) {
            /// @dev scenario 1: a trader comes in and trades all the liqudiity all the way to tickUpper given current liqudity of the LP
            /// @dev scenario 2: current tick never reaches the tickLower (LP stays with their current fixed and variable token balances)

            /// @dev from the perspective of the LP (not the trader who is a Fixed Taker)
            /// @dev Scenario 1

            /// @dev this value is negative since the LP is a Variable Taker in this case
            int256 amount0FromTickLowerToTickUpper = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    -int128(params.liquidity)
                );

            /// @dev this value is positive since the LP is a Variable Taker in this case
            int256 amount1FromTickLowerToTickUpper = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(params.liquidity)
                );

            scenario1LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromTickLowerToTickUpper;

            scenario1LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromTickLowerToTickUpper,
                    amount1FromTickLowerToTickUpper,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );

            /// @dev Scenario 2
            scenario2LPVariableTokenBalance = params.variableTokenBalance;
            scenario2LPFixedTokenBalance = params.fixedTokenBalance;
        } else if (params.currentTick < params.tickUpper) {
            /// @dev scenario 1: a trader comes in and trades all the liquidity from currentTick to tickUpper given current liquidity of LP
            /// @dev scenario 2: a trader comes in and trades all the liquidity from currentTick to tickLower given current liquidity of LP

            /// @dev from the perspective of the LP (not the trader who is a Fixed Taker)
            /// @dev Scenario 1

            /// @dev this value is negative since the LP is a Variable Taker in this case
            int256 amount0FromCurrentTickToTickUpper = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    -int128(params.liquidity)
                );

            /// @dev this value is positive since the LP is a Variable Taker in this case
            int256 amount1FromCurrentTickToTickUpper = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(params.liquidity)
                );

            scenario1LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromCurrentTickToTickUpper;
            scenario1LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromCurrentTickToTickUpper,
                    amount1FromCurrentTickToTickUpper,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );

            /// @dev from the perspective of the LP (not the trader who is a Variable Taker)
            /// @dev Scenario 2

            /// @dev this value is positive since the LP is a Fixed Taker in this case
            int256 amount0FromCurrentTickToTickLower = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    int128(params.liquidity)
                );

            /// @dev this value is negative since the LP is a FixedTaker in this case
            int256 amount1FromCurrentTickToTickLower = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    -int128(params.liquidity)
                );

            scenario2LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromCurrentTickToTickLower;
            scenario2LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromCurrentTickToTickLower,
                    amount1FromCurrentTickToTickLower,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );
        } else {
            /// @dev scenario 1: a trader comes in and trades all the liqudiity all the way to tickLower given current liqudity of the LP
            /// @dev scenario 2: current tick never reaches the tickUpper (LP stays with their current fixed and variable token balances)

            /// @dev from the perspective of the LP (not the trader who is a Variable Taker)
            /// @dev Scenario 1

            /// @dev this value is positive since the LP is a Fixed Taker in this case
            int256 amount0FromTickUpperToTickLower = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    int128(params.liquidity)
                );

            /// @dev this value is negative since the LP is a Fixed Taker in this case
            int256 amount1FromTickUpperToTickLower = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    -int128(params.liquidity)
                );

            scenario1LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromTickUpperToTickLower;
            scenario1LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromTickUpperToTickLower,
                    amount1FromTickUpperToTickLower,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );

            /// @dev Scenario 2
            scenario2LPVariableTokenBalance = params.variableTokenBalance;
            scenario2LPFixedTokenBalance = params.fixedTokenBalance;
        }

        // @audit make sure correct current prices are provided in here as per the overleaf doc

        uint160 scenario1SqrtPriceX96;
        uint160 scenario2SqrtPriceX96;

        if (scenario1LPVariableTokenBalance > 0) {
            // will engage in a (counterfactual) fixed taker unwind for minimum margin requirement
            scenario1SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                params.tickUpper
            );
            if (scenario1SqrtPriceX96 < params.sqrtPriceX96) {
                scenario1SqrtPriceX96 = params.sqrtPriceX96;
            }
        } else {
            // will engage in a (counterfactual) variable taker unwind for minimum margin requirement
            scenario1SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                params.tickLower
            );
            if (scenario1SqrtPriceX96 > params.sqrtPriceX96) {
                scenario1SqrtPriceX96 = params.sqrtPriceX96;
            }
        }

        if (scenario2LPVariableTokenBalance > 0) {
            // will engage in a (counterfactual) fixed taker unwind for minimum margin requirement
            scenario2SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                params.tickUpper
            );

            if (scenario2SqrtPriceX96 < params.sqrtPriceX96) {
                scenario2SqrtPriceX96 = params.sqrtPriceX96;
            }
        } else {
            // will engage in a (counterfactual) variable taker unwind for minimum margin requirement
            scenario2SqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                params.tickLower
            );

            if (scenario2SqrtPriceX96 > params.sqrtPriceX96) {
                scenario2SqrtPriceX96 = params.sqrtPriceX96;
            }
        }

        uint256 scenario1MarginRequirement = getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: scenario1LPFixedTokenBalance,
                variableTokenBalance: scenario1LPVariableTokenBalance,
                termStartTimestampWad: params.termStartTimestampWad,
                termEndTimestampWad: params.termEndTimestampWad,
                isLM: params.isLM,
                historicalApyWad: params.historicalApyWad,
                sqrtPriceX96: scenario1SqrtPriceX96,
                variableFactorWad: params.variableFactorWad
            }),
            _marginCalculatorParameters
        );

        uint256 scenario2MarginRequirement = getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: scenario2LPFixedTokenBalance,
                variableTokenBalance: scenario2LPVariableTokenBalance,
                termStartTimestampWad: params.termStartTimestampWad,
                termEndTimestampWad: params.termEndTimestampWad,
                isLM: params.isLM,
                historicalApyWad: params.historicalApyWad,
                sqrtPriceX96: scenario2SqrtPriceX96,
                variableFactorWad: params.variableFactorWad
            }),
            _marginCalculatorParameters
        );

        if (scenario1MarginRequirement > scenario2MarginRequirement) {
            return scenario1MarginRequirement;
        } else {
            return scenario2MarginRequirement;
        }

        } else {



        }
        
       
    }

    /// @notice Checks if a given position is liquidatable
    /// @dev In order for a position to be liquidatable its current margin needs to be lower than the position's liquidation margin requirement
    /// @return _isLiquidatable A boolean which suggests if a given position is liquidatable
    function isLiquidatablePosition(
        PositionMarginRequirementParams memory params,
        int256 currentMargin,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (bool _isLiquidatable) {
        uint256 marginRequirement = getPositionMarginRequirement(
            params,
            _marginCalculatorParameters
        );
        if (currentMargin < int256(marginRequirement)) {
            _isLiquidatable = true;
        } else {
            _isLiquidatable = false;
        }
    }


    /// @notice Returns either the Liquidation or Initial Margin Requirement of a given trader
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @return margin Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens
    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 margin) {
        margin = _getTraderMarginRequirement(
            params,
            _marginCalculatorParameters
        );

        Printer.printUint256("margin", margin);

        uint256 minimumMarginRequirement = getMinimumMarginRequirement(
            params,
            _marginCalculatorParameters
        );

        Printer.printUint256(
            "minimumMarginRequirement",
            minimumMarginRequirement
        );

        if (margin < minimumMarginRequirement) {
            margin = minimumMarginRequirement;
        }
    }

    function _getTraderMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isLM
    ) internal view returns (uint256 margin) {
    
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
        uint160 sqrtPriceX96,
    ) internal view returns (uint256 margin) {
        
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
                getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(
                    uint256(-params.variableTokenBalance),
                    params.sqrtPriceX96,
                    devMulWad,
                    fixedRateDeviationMinWad,
                    params.termEndTimestampWad,
                    Time.blockTimestampScaled(),
                    uint256(_marginCalculatorParameters.tMaxWad),
                    _marginCalculatorParameters.gammaWad,
                    false
                )
            );
        }

        int256 variableTokenDelta = -params.variableTokenBalance;

        int256 fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
            fixedTokenDeltaUnbalanced,
            variableTokenDelta,
            params.variableFactorWad,
            params.termStartTimestampWad,
            params.termEndTimestampWad
        );

        Printer.printInt256("fixedTokenDelta", fixedTokenDelta);

        int256 updatedVariableTokenBalance = params.variableTokenBalance +
            variableTokenDelta; // should be zero
        int256 updatedFixedTokenBalance = params.fixedTokenBalance +
            fixedTokenDelta;

        margin = _getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: updatedFixedTokenBalance,
                variableTokenBalance: updatedVariableTokenBalance,
                termStartTimestampWad: params.termStartTimestampWad,
                termEndTimestampWad: params.termEndTimestampWad,
                isLM: params.isLM,
                historicalApyWad: params.historicalApyWad,
                sqrtPriceX96: params.sqrtPriceX96,
                variableFactorWad: params.variableFactorWad
            }),
            _marginCalculatorParameters
        );

        if (
            margin <
            _marginCalculatorParameters.minMarginToIncentiviseLiquidators
        ) {
            margin = _marginCalculatorParameters
                .minMarginToIncentiviseLiquidators;
        }
    }


}