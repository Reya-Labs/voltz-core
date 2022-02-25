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
import "./core_libraries/SafeTransferLib.sol";
import "contracts/utils/Printer.sol";

contract MarginEngine is IMarginEngine, Initializable, OwnableUpgradeable, PausableUpgradeable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);

    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    using SafeTransferLib for IERC20Minimal;

    uint256 public override liquidatorRewardWad;
    IERC20Minimal public override underlyingToken;

    /// @inheritdoc IMarginEngine
    uint256 public override termStartTimestampWad;
    /// @inheritdoc IMarginEngine
    uint256 public override termEndTimestampWad;
    
    /// @inheritdoc IMarginEngine
    IFCM public override fcm;

    mapping(bytes32 => Position.Info) internal positions;
    
    IVAMM public override vamm;

    MarginCalculatorParameters internal marginCalculatorParameters;

    /// @inheritdoc IMarginEngine
    uint256 public override secondsAgo;

    uint256 internal cachedHistoricalApyWad;
    uint256 private cachedHistoricalApyWadRefreshTimestamp;

    uint256 public cacheMaxAgeInSeconds;

    address private deployer;
    /// @inheritdoc IMarginEngine
    IFactory public override factory;
    /// @inheritdoc IMarginEngine
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

        underlyingToken = IERC20Minimal(_underlyingToken);
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

    /// @dev Modifier that ensures only the VAMM can execute certain actions
    modifier onlyVAMM () {
        if (msg.sender != address(vamm)) {
            revert OnlyVAMM();
        }
        _;
    }
    
    /// @dev Modifier that reverts if the msg.sender is not the Full Collateralisation Module
    modifier onlyFCM () {
        if (msg.sender != address(fcm)) {
            revert OnlyFCM();
        }
        _;
    }
    
    /// @dev Modifier that reverts if the termEndTimestamp is higher than the current block timestamp
    /// @dev This modifier ensures that actions such as settlePosition (can only be done after maturity)
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

    /// @inheritdoc IMarginEngine
    function setMarginCalculatorParameters(
        MarginCalculatorParameters memory _marginCalculatorParameters
    ) external override onlyOwner {
        marginCalculatorParameters = _marginCalculatorParameters;
    }
    
    /// @inheritdoc IMarginEngine
    function setVAMM(address _vAMMAddress) external override onlyOwner {
        vamm = IVAMM(_vAMMAddress);
    }
    /// @inheritdoc IMarginEngine
    function setFCM(address _fcm) external override onlyOwner {
        fcm = IFCM(_fcm);
    }

    /// @inheritdoc IMarginEngine
    function setSecondsAgo(uint256 _secondsAgo)
        external
        override
        onlyOwner
    {
        uint256 secondsAgoOld = secondsAgo;
        secondsAgo = _secondsAgo;
        emit HistoricalApyWindowSet(secondsAgoOld, secondsAgo);
    }

    /// @inheritdoc IMarginEngine
    function setCacheMaxAgeInSeconds(uint256 _cacheMaxAgeInSeconds)
        external
        override 
        onlyOwner
    {
        uint256 cacheMaxAgeInSecondsOld = cacheMaxAgeInSeconds;
        cacheMaxAgeInSeconds = _cacheMaxAgeInSeconds;
        emit CacheMaxAgeSet(cacheMaxAgeInSecondsOld, cacheMaxAgeInSeconds);
    }

    /// @inheritdoc IMarginEngine
    function collectProtocol(address recipient, uint256 amount)
        external
        override
        onlyOwner{

        if (amount > 0) {
            /// @dev if the amount exceeds the available balances, vamm.updateProtocolFees(amount) should be reverted as intended
            vamm.updateProtocolFees(amount);
            underlyingToken.safeTransfer(
                recipient,
                amount
            );
        }

        emit CollectProtocol(msg.sender, recipient, amount);
    }

    /// @inheritdoc IMarginEngine
    function setLiquidatorReward(uint256 _liquidatorRewardWad) external override onlyOwner {
        uint256 liquidatorRewardWadOld = liquidatorRewardWad;
        liquidatorRewardWad = _liquidatorRewardWad;
        emit LiquidatorRewardSet(liquidatorRewardWadOld, liquidatorRewardWad);
    }

    /// @inheritdoc IMarginEngine
    function getPosition(address _owner,
                         int24 tickLower,
                         int24 tickUpper)
        external override view returns (Position.Info memory position) {
            /// Costin: update position to account for fees?
            return positions.get(_owner, tickLower, tickUpper);
    }

    /// @notice transferMargin function which:
    /// @dev Transfers funds in from account if _marginDelta is positive, or out to account if _marginDelta is negative
    /// @dev if the margiDelta is positive, we conduct a safe transfer from the _account address to the address of the MarginEngine
    /// @dev if the marginDelta is negative, the user wishes to withdraw underlying tokens from the MarginEngine,
    /// @dev in that case we first check the balance of the marginEngine in terms of the underlying tokens, if the balance is sufficient to cover the margin transfer, then we cover it via a safeTransfer
    /// @dev if the marginEngineBalance is not sufficient to cover the marginDelta then we cover the remainingDelta by invoking the transferMarginToMarginEngineTrader function of the fcm which in case of Aave will calls the Aave withdraw function to settle with the MarginEngine in underlying tokens
    function transferMargin(address _account, int256 _marginDelta) internal {
        if (_marginDelta > 0) {
            underlyingToken.safeTransferFrom(_account, address(this), uint256(_marginDelta));
        } else {
            uint256 marginEngineBalance = underlyingToken.balanceOf(address(this));

            if (uint256(-_marginDelta) > marginEngineBalance) {
                uint256 remainingDeltaToCover = uint256(-_marginDelta);
                if (marginEngineBalance > 0) {
                    remainingDeltaToCover = remainingDeltaToCover - marginEngineBalance;
                    underlyingToken.safeTransfer(_account, marginEngineBalance);
                }
                fcm.transferMarginToMarginEngineTrader(_account, remainingDeltaToCover);
            } else {
                underlyingToken.safeTransfer(_account, uint256(-_marginDelta));
            }

        }
    }


    /// @inheritdoc IMarginEngine
    function transferMarginToFCMTrader(address _account, uint256 marginDelta) external onlyFCM override {
        underlyingToken.safeTransfer(_account, marginDelta);
    }

    /// @inheritdoc IMarginEngine
    function updatePositionMargin(address _owner, int24 tickLower, int24 tickUpper, int256 marginDelta) external nonZeroDelta(marginDelta) override {
        
        Tick.checkTicks(tickLower, tickUpper);
        
        Position.Info storage position = positions.get(_owner, tickLower, tickUpper);
        
        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);

        require((position.margin + marginDelta) >= 0, "can't withdraw more than have");
        
        if (marginDelta < 0) {

            if (_owner != msg.sender && !factory.isApproved(_owner, msg.sender)) {
                revert OnlyOwnerCanUpdatePosition();
            }

            position.updateMarginViaDelta(marginDelta);

            checkPositionMarginCanBeUpdated(position, tickLower, tickUpper); 

            transferMargin(_owner, marginDelta);

        } else {

            position.updateMarginViaDelta(marginDelta);

            address depositor;
            if (factory.isApproved(_owner, msg.sender)) {
                depositor = _owner;
            } else {
                depositor = msg.sender;
            }

            transferMargin(depositor, marginDelta);
        }

        position.rewardPerAmount = 0;

        emit UpdatePositionMargin(_owner, tickLower, tickUpper, position.margin);

    }
    
    
    /// @inheritdoc IMarginEngine
    function settlePosition(int24 tickLower, int24 tickUpper, address _owner) external override whenNotPaused onlyAfterMaturity {
        
        Tick.checkTicks(tickLower, tickUpper);

        Position.Info storage position = positions.get(_owner, tickLower, tickUpper); 
            
        require(!position.isSettled, "already settled");
        
        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);
        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestampWad, termEndTimestampWad, rateOracle.variableFactor(termStartTimestampWad, termEndTimestampWad));

        position.updateBalancesViaDeltas(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMarginViaDelta(settlementCashflow);
        position.settlePosition();

        emit SettlePosition(_owner, tickLower, tickUpper, position.fixedTokenBalance, position.variableTokenBalance, position.margin, position.isSettled);

    }
    
    /// @inheritdoc IMarginEngine
    function getHistoricalApy()
        public
        override
        returns (uint256)
    {
        if (cachedHistoricalApyWadRefreshTimestamp < block.timestamp - cacheMaxAgeInSeconds) {
            // Cache is stale
            _refreshHistoricalApyCache();
        }
        return cachedHistoricalApyWad;
    }

    /// @notice Computes the historical APY value of the RateOracle
    /// @dev The lookback window used by this function is determined by the secondsAgo state variable
    function getHistoricalApyReadOnly()
        public
        view
        returns (uint256)
    {
        if (cachedHistoricalApyWadRefreshTimestamp < block.timestamp - cacheMaxAgeInSeconds) {
            // Cache is stale
            return _getHistoricalApy();
        }
        return cachedHistoricalApyWad;
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
        cachedHistoricalApyWad = _getHistoricalApy();
        cachedHistoricalApyWadRefreshTimestamp = block.timestamp;
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

        if (position.rewardPerAmount == 0) {
            if (position.variableTokenBalance < 0) {
                position.rewardPerAmount = PRBMathUD60x18.div(PRBMathUD60x18.mul(uint256(position.margin), liquidatorRewardWad), uint256(-position.variableTokenBalance));
            }
            else {
                position.rewardPerAmount = PRBMathUD60x18.div(PRBMathUD60x18.mul(uint256(position.margin), liquidatorRewardWad), uint256(position.variableTokenBalance));
            }
        }

        if (position._liquidity > 0) {
            /// @dev pass position._liquidity to ensure all of the liqudity is burnt
            vamm.burn(_owner, tickLower, tickUpper, position._liquidity);
            position.updateLiquidity(-int128(position._liquidity));
        }
    
        int256 _variableTokenDelta = unwindPosition(position, _owner, tickLower, tickUpper);

        Printer.printInt256("variableTokenBalance", position.variableTokenBalance);
        Printer.printInt256("_variableTokenDelta", _variableTokenDelta);
        Printer.printUint256("rewardPerAmount", position.rewardPerAmount);

        if (_variableTokenDelta == 0) return;

        uint256 liquidatorRewardValue = (_variableTokenDelta < 0)
            ? PRBMathUD60x18.mul(uint256(-_variableTokenDelta), position.rewardPerAmount)
            : PRBMathUD60x18.mul(uint256(_variableTokenDelta), position.rewardPerAmount);

        Printer.printUint256("liquidatorRewardValue", liquidatorRewardValue);

        position.updateMarginViaDelta(-int256(liquidatorRewardValue));
        underlyingToken.safeTransfer(msg.sender, liquidatorRewardValue);

        // todo: add msg.sender to the event (as the initiator of the liquidation)
        emit LiquidatePosition(_owner, tickLower, tickUpper, position.fixedTokenBalance, position.variableTokenBalance, position.margin, position._liquidity);
    }


    /// @inheritdoc IMarginEngine
    function updatePositionPostVAMMInducedMintBurn(IVAMM.ModifyPositionParams memory params) external onlyVAMM override {

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);

        updatePositionTokenBalancesAndAccountForFees(position, params.tickLower, params.tickUpper, true);

        position.updateLiquidity(params.liquidityDelta);

        if (params.liquidityDelta>0) {
            checkPositionMarginAboveRequirement(position, params.tickLower, params.tickUpper);
        }

        position.rewardPerAmount = 0;

        emit UpdatePositionPostMintBurn(params.owner, params.tickLower, params.tickUpper, position._liquidity);

    }

    /// @inheritdoc IMarginEngine
    function updatePositionPostVAMMInducedSwap(address _owner, int24 tickLower, int24 tickUpper, int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred) external onlyVAMM override {
        /// @dev this function can only be called by the vamm following a swap    

        Position.Info storage position = positions.get(_owner, tickLower, tickUpper);
        updatePositionTokenBalancesAndAccountForFees(position, tickLower, tickUpper, false);

        if (cumulativeFeeIncurred > 0) {
            position.updateMarginViaDelta(-int256(cumulativeFeeIncurred));
        }

        position.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);

        int256 positionMarginRequirement = int256(
            getPositionMarginRequirement(position, tickLower, tickUpper, false)
        );

        if (positionMarginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }

        position.rewardPerAmount = 0;

        emit UpdatePositionPostSwap(_owner, tickLower, tickUpper, position.fixedTokenBalance, position.variableTokenBalance, position.margin);
    }
    

    /// @notice update position token balances and account for fees
    /// @dev if the _liquidity of the position supplied to this function is >0 then we
    /// @dev 1. retrieve the fixed, variable and fee Growth variables from the vamm by invoking the computeGrowthInside function of the VAMM
    /// @dev 2. calculate the deltas that need to be applied to the position's fixed and variable token balances by taking into account trads that took place in the VAMM since the last mint/poke/burn that invoked this function
    /// @dev 3. update the fixed and variable token balances and the margin of the positioin to account for deltas (outlined above) and fees generated by the active liquidity supplied by the position
    /// @dev 4. additionally, we need to update the last growth inside variables in the Position.Info struct so that we take a note that we've accounted for the changes up until this point 
    /// @dev if _liquidity of the position supplied to this function is zero, then we need to check if isMintBurn is set to true (if it is set to true) then we know thsi function was called post a mint/burn event,
    /// @dev meaning we still need to correctly update the last fixed, variable and fee growth variables in the Position.Info struct
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
            position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
            /// @dev collect fees
            position.updateMarginViaDelta(int256(feeDelta));
            position.updateFeeGrowthInside(feeGrowthInsideX128);
        } else {
            if (isMintBurn) {
                (int256 fixedTokenGrowthInsideX128, int256 variableTokenGrowthInsideX128, uint256 feeGrowthInsideX128) = vamm.computeGrowthInside(tickLower, tickUpper);
                position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
                position.updateFeeGrowthInside(feeGrowthInsideX128);
            }
        }
    }
    

    /// @notice Internal function that checks if the position's current margin is above the requirement
    /// @param position Position.Info of the position of interest, updates to position, edit it in storage
    /// @param tickLower Lower Tick of the position
    /// @param tickUpper Upper Tick of the position
    /// @dev This function calculates the position margin requirement, compares it with the position.margin and reverts if the current position margin is below the requirement
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


    /// @notice Check the position margin can be updated
    /// @param position Position.Info of the position of interest, updates to position, edit it in storage
    /// @param tickLower Lower Tick of the position
    /// @param tickUpper Upper Tick of the position
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
            /// @dev if we haven't reached maturity yet, then check if the positon margin requirement is satisfied if not then the position margin update will also revert
            checkPositionMarginAboveRequirement(
                position,
                tickLower,
                tickUpper
            );
        }
    }

    
    /// @notice Unwind a position
    /// @dev Before unwinding a position, need to check if it is even necessary to unwind it, i.e. check if the most up to date variable token balance of a position is non-zero
    /// @dev If the current variable token balance is negative, then it means the position is a net Fixed Taker
    /// @dev Hence to unwind, we need to enter into a Variable Taker IRS contract with notional = abs(current variable token balance of the position)
    /// @param _owner the owner of the position
    /// @param tickLower the lower tick of the position's tick range
    /// @param tickUpper the upper tick of the position's tick range
    function unwindPosition(
        Position.Info storage position,
        address _owner,
        int24 tickLower,
        int24 tickUpper
    ) internal returns (int256 _variableTokenDelta) {

        Tick.checkTicks(tickLower, tickUpper);

        if (position.variableTokenBalance != 0 ) {

            int256 _fixedTokenDelta;
            uint256 _cumulativeFeeIncurred;

            /// @dev initiate a swap

            bool isFT = position.variableTokenBalance < 0;

            if (isFT) {

                /// @dev get into a Variable Taker swap (the opposite of LP's current position) --> hence params.isFT is set to false for the vamm swap call
                /// @dev amountSpecified needs to be negative (since getting into a variable taker swap)
                /// @dev since the position.variableTokenBalance is already negative, pass position.variableTokenBalance as amountSpecified
                /// @dev since moving from left to right along the virtual amm, sqrtPriceLimit is set to MIN_SQRT_RATIO + 1
                /// @dev isExternal is a boolean that ensures the state updates to the position are handled directly in the body of the unwind call
                /// @dev that's more efficient than letting the swap call the margin engine again to update position fixed and varaible token balances + account for fees

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: _owner,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO + 1,
                    isExternal: true,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred,) = vamm.swap(params);
            } else {

                /// @dev get into a Fixed Taker swap (the opposite of LP's current position)
                /// @dev amountSpecified needs to be positive, since we are executing a fixedd taker swap
                /// @dev since the position.variableTokenBalance is already positive, pass position.variableTokenBalance as amountSpecified
                /// @dev since moving from right to left along the virtual amm, sqrtPriceLimit is set to MAX_SQRT_RATIO - 1

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: _owner,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO - 1,
                    isExternal: true,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred,) = vamm.swap(params);
            }

            if (_cumulativeFeeIncurred > 0) {
                /// @dev update position margin to account for the fees incurred while conducting a swap in order to unwind
                position.updateMarginViaDelta(-int256(_cumulativeFeeIncurred));
            }

            /// @dev passes the _fixedTokenBalance and _variableTokenBalance deltas
            position.updateBalancesViaDeltas(_fixedTokenDelta, _variableTokenDelta);
        }

    }

    
    function getExtraBalances(int24 from, int24 to, uint128 liquidity, uint256 variableFactorWad) internal view returns (int256 extraFixedTokenBalance, int256 extraVariableTokenBalance) {
        if (from == to) return (0, 0);
        
        int256 amount0 = SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(from),
            TickMath.getSqrtRatioAtTick(to),
            (from < to) ? -int128(liquidity) : int128(liquidity)
        );

        int256 amount1 = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(from),
            TickMath.getSqrtRatioAtTick(to),
            (from < to) ? int128(liquidity) : -int128(liquidity)
        );

        extraFixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(
                        amount0,
                        amount1,
                        variableFactorWad,
                        termStartTimestampWad,
                        termEndTimestampWad
                    );

        extraVariableTokenBalance = amount1;
    }


    /// @notice Get Position Margin Requirement
    /// @dev if the position has no active liquidity in the VAMM, then we can compute its margin requirement by just passing its current fixed and variable token balances to teh getMarginRequirement function
    /// @dev however, if the current _liquidity of the position is positive, it means that the position can potentially enter into interest rate swap positions with traders in their tick range
    /// @dev to account for that possibility, we analyse two scenarios:
    /// @dev scenario 1: a trader comes in and trades all the liquidity all the way to the the upper tick
    /// @dev scenario 2: a trader comes in and trades all the liquidity all the way to the the lower tick
    /// @dev one the fixed and variable token balances are calculated for each counterfactual scenarios, their margin requiremnets can be obtained by calling getMarginrRequirement for each scenario
    /// @dev finally, the output is the max of the margin requirements from two of the scenarios considered
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
            PositionMarginRequirementLocalVars2 memory localVars;
            localVars.inRangeTick = (tick < tickLower) ? tickLower : ((tick < tickUpper) ? tick : tickUpper);

            // scenario 1: a trader comes in and trades all the liquidity all the way to the the upper tick
            // scenario 2: a trader comes in and trades all the liquidity all the way to the the lower tick
            
            (int256 extraFixedTokenBalance, int256 extraVariableTokenBalance) = getExtraBalances(localVars.inRangeTick, tickUpper, position._liquidity, variableFactorWad);
            localVars.scenario1LPVariableTokenBalance =
                    position.variableTokenBalance + extraVariableTokenBalance;

            localVars.scenario1LPFixedTokenBalance =
                    position.fixedTokenBalance + extraFixedTokenBalance;

            (extraFixedTokenBalance, extraVariableTokenBalance) = getExtraBalances(localVars.inRangeTick, tickLower, position._liquidity, variableFactorWad);
            localVars.scenario2LPVariableTokenBalance =
                    position.variableTokenBalance + extraVariableTokenBalance;

            localVars.scenario2LPFixedTokenBalance =
                    position.fixedTokenBalance + extraFixedTokenBalance;

            uint160 priceAtLowerTick = TickMath.getSqrtRatioAtTick(tickLower);
            uint160 priceAtUpperTick = TickMath.getSqrtRatioAtTick(tickUpper);
        
            localVars.scenario1SqrtPriceX96 = (localVars.scenario1LPVariableTokenBalance > 0) 
                ? ((sqrtPriceX96 > priceAtUpperTick) ? sqrtPriceX96 : priceAtUpperTick) 
                : ((sqrtPriceX96 < priceAtLowerTick) ? sqrtPriceX96 : priceAtLowerTick);

            localVars.scenario2SqrtPriceX96 = (localVars.scenario2LPVariableTokenBalance > 0) 
                ? ((sqrtPriceX96 > priceAtUpperTick) ? sqrtPriceX96 : priceAtUpperTick) 
                : ((sqrtPriceX96 < priceAtLowerTick) ? sqrtPriceX96 : priceAtLowerTick);


            uint256 scenario1MarginRequirement = getMarginRequirement(localVars.scenario1LPFixedTokenBalance, localVars.scenario1LPVariableTokenBalance, isLM, localVars.scenario1SqrtPriceX96);
            uint256 scenario2MarginRequirement = getMarginRequirement(localVars.scenario2LPFixedTokenBalance, localVars.scenario2LPVariableTokenBalance, isLM, localVars.scenario2SqrtPriceX96);

            if (scenario1MarginRequirement > scenario2MarginRequirement) {
                return scenario1MarginRequirement;
            } else {
                return scenario2MarginRequirement;
            }

        } else {
            // directly get the trader margin requirement
            return getMarginRequirement(position.fixedTokenBalance, position.variableTokenBalance, isLM, sqrtPriceX96);
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


    /// @notice Returns either the Liquidation or Initial Margin Requirement given a fixed and variable token balance as well as the isLM boolean
    /// @return margin  either liquidation or initial margin requirement of a given trader in terms of the underlying tokens
    function getMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isLM,
        uint160 sqrtPriceX96
    ) internal returns (uint256 margin) {    
        margin = _getMarginRequirement(
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

    /// @notice get margin requirement based on a fixed and variable token balance and isLM boolean
    function _getMarginRequirement(
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


        /// exp1 = fixedTokenBalance*timeInYearsFromTermStartToTermEnd*0.01
        // this can either be negative or positive depending on the sign of the fixedTokenBalance
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
        
        /// exp2 = variableTokenBalance*worstCaseVariableFactor(from term start to term end)
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

        // this is the worst case settlement cashflow expected by the position to cover
        int256 maxCashflowDeltaToCoverPostMaturity = exp1Wad + exp2Wad;

        // hence if maxCashflowDeltaToCoverPostMaturity is negative then the margin needs to be sufficient to cover it
        // if maxCashflowDeltaToCoverPostMaturity is non-negative then it means according to this model the even in the worst case, the settlement cashflow is expected to be non-negative
        // hence, returning zero as the margin requirement
        if (maxCashflowDeltaToCoverPostMaturity < 0) {
            margin = PRBMathUD60x18.toUint(
                uint256(-maxCashflowDeltaToCoverPostMaturity)
            );
        } else {
            margin = 0;
        }
    }


    /// @notice Get Minimum Margin Requirement
    // given the fixed and variable balances and a starting sqrtPriceX96
    // we calculate the minimum marign requirement by simulating a counterfactual unwind at fixed rate that is a function of the current fixed rate (sqrtPriceX96) (details in the litepaper)
    // if the variable token balance is 0 or if the variable token balance is >0 and the fixed token balace >0 then the minimum margin requirement is zero
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

            // simulate an adversarial unwind (cumulative position is a Variable Taker --> simulate FT unwind --> movement to the left along the VAMM)
            // fixedTokenDelta unbalanced that results from the simulated unwind
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

        margin = _getMarginRequirement(
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