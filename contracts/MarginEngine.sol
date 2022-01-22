// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";
import "./core_libraries/MarginCalculator.sol";
import "./utils/SafeCast.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
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
    using Trader for Trader.Info;

    /// @dev liquidatorReward (in wei) is the percentage of the margin (of a liquidated trader/liquidity provider) that is sent to the liquidator 
    /// @dev following a successful liquidation that results in a trader/position unwind, example value:  2 * 10**15;
    uint256 public override liquidatorReward;
    /// @inheritdoc IMarginEngine
    address public override underlyingToken;
    /// @inheritdoc IMarginEngine
    uint256 public override termStartTimestampWad;
    /// @inheritdoc IMarginEngine
    uint256 public override termEndTimestampWad;
    /// @inheritdoc IMarginEngine
    address public override rateOracleAddress;

    address public override fcm; // full collateralisation module

    mapping(bytes32 => Position.Info) internal positions;
    /// @inheritdoc IMarginEngine
    mapping(address => Trader.Info) public override traders;

    address public override vammAddress;

    MarginCalculatorParameters internal marginCalculatorParameters;

    /// @inheritdoc IMarginEngine
    uint256 public override secondsAgo;

    address private deployer;

    bool public isInsuranceDepleted;

    uint256 public minMarginToIncentiviseLiquidators;

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
        rateOracleAddress = _rateOracleAddress;
        termStartTimestampWad = _termStartTimestampWad;
        termEndTimestampWad = _termEndTimestampWad;

        __Ownable_init();
        __Pausable_init();
    }

    /// Only the position/trade owner can update the LP/Trader margin
    error OnlyOwnerCanUpdatePosition();

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

    function setVAMMAddress(address _vAMMAddress) external override onlyOwner {
        vammAddress = _vAMMAddress;
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
        secondsAgo = _secondsAgo; // in wei

        // @audit emit seconds ago set
    }

    function setIsInsuranceDepleted(bool _isInsuranceDepleted) external override onlyOwner {
        isInsuranceDepleted = _isInsuranceDepleted;
    }

    function setMinMarginToIncentiviseLiquidators(uint256 _minMarginToIncentiviseLiquidators) external override onlyOwner {
        minMarginToIncentiviseLiquidators = _minMarginToIncentiviseLiquidators;
    }

    function collectProtocol(address recipient, uint256 amount)
        external
        override
        onlyOwner{

        if (amount > 0) {
            /// @dev if the amount exceeds the available balances, IVAMM(vammAddress).updateProtocolFees(amount) should be reverted as intended
            IVAMM(vammAddress).updateProtocolFees(amount);
            IERC20Minimal(underlyingToken).transfer(
                recipient,
                amount
            );
        }

        // emit collect protocol event
    }
    
    function setLiquidatorReward(uint256 _liquidatorReward) external override onlyOwner {
        liquidatorReward = _liquidatorReward;
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
            IERC20Minimal(underlyingToken).transfer(_account, uint256(-_marginDelta));
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external nonZeroDelta(marginDelta) override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        updatePositionTokenBalancesAndAccountForFees(params.owner, params.tickLower, params.tickUpper);
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  
        require((position.margin + marginDelta) > 0, "can't withdraw more than have");
        
        if (marginDelta < 0) {

            if (params.owner != msg.sender) {
                revert OnlyOwnerCanUpdatePosition();
            }

            if (isInsuranceDepleted) {

                position.updateMarginViaDelta(marginDelta);

                transferMargin(msg.sender, marginDelta);

            } else {

                uint256 variableFactorWad = IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad);
            
                int256 updatedMarginWouldBe = position.margin + marginDelta;

                checkPositionMarginCanBeUpdated(params, updatedMarginWouldBe, position._liquidity==0, position.isSettled, position._liquidity, position.fixedTokenBalance, position.variableTokenBalance, variableFactorWad); 

                position.updateMarginViaDelta(marginDelta);

                transferMargin(msg.sender, marginDelta);
            }

        } else {

            position.updateMarginViaDelta(marginDelta);

            transferMargin(msg.sender, marginDelta);
        }
           
    }
    

    /// @inheritdoc IMarginEngine
    function updateTraderMargin(address traderAddress, int256 marginDelta) external nonZeroDelta(marginDelta) override {
        
        Trader.Info storage trader = traders[traderAddress];
        require((trader.margin + marginDelta) > 0, "can't withdraw more than have");
        
        if (marginDelta < 0) {

            if (traderAddress != msg.sender) {
                revert OnlyOwnerCanUpdatePosition();
            }

            if (isInsuranceDepleted) {

                trader.updateMarginViaDelta(marginDelta);

                transferMargin(msg.sender, marginDelta);

            } else {
                int256 updatedMarginWouldBe = trader.margin + marginDelta;
            
                checkTraderMarginCanBeUpdated(updatedMarginWouldBe, trader.fixedTokenBalance, trader.variableTokenBalance, trader.isSettled);

                trader.updateMarginViaDelta(marginDelta);

                transferMargin(msg.sender, marginDelta);
            }

        } else {
            
            trader.updateMarginViaDelta(marginDelta);

            transferMargin(msg.sender, marginDelta);
        }

    }
    
    /// @inheritdoc IMarginEngine
    function settlePosition(ModifyPositionParams memory params) external override whenNotPaused onlyAfterMaturity {
        
        Tick.checkTicks(params.tickLower, params.tickUpper);

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper); 
            
        /// @dev position can only be settled if it is burned and not settled
        require(position._liquidity==0, "fully burned");
        require(!position.isSettled, "already settled");

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestampWad, termEndTimestampWad, IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad));

        position.updateBalancesViaDeltas(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMarginViaDelta(settlementCashflow);
        position.settlePosition();
    }
    
    /// @inheritdoc IMarginEngine
    function settleTrader(address traderAddress) external override whenNotPaused onlyAfterMaturity {
        
        /// @dev anyone should be able to call this function post matrity

        Trader.Info storage trader = traders[traderAddress];

        require(!trader.isSettled, "not settled");

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, termStartTimestampWad, termEndTimestampWad, IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad));

        trader.updateBalancesViaDeltas(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMarginViaDelta(settlementCashflow);
        trader.settleTrader();
    }

    /// @notice Computes the historical APY value of the RateOracle 
    /// @dev The lookback window used by this function is determined by the secondsAgo state variable    
    function getHistoricalApy()
        public
        view
        virtual // virtual because overridden by tests // @audit should virtual be removed?
        returns (uint256 historicalApy)
    {
        uint256 to = block.timestamp;
        uint256 from = to - secondsAgo;

        return IRateOracle(rateOracleAddress).getApyFromTo(from, to);
    }
    
    
    /// @inheritdoc IMarginEngine
    function liquidatePosition(ModifyPositionParams memory params) external checkCurrentTimestampTermEndTimestampDelta override {

        /// @dev can only happen before maturity, this is checked when an unwind is triggered which in turn triggers a swap which checks for this condition
        /// @audit introduce pre maturity check

        Tick.checkTicks(params.tickLower, params.tickUpper);

        (, int24 tick, ) = IVAMM(vammAddress).vammVars();
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
                historicalApyWad: getHistoricalApy()
            }),
            position.margin,
            marginCalculatorParameters
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        uint256 liquidatorRewardValue = PRBMathUD60x18.mul(uint256(position.margin), liquidatorReward);

        position.updateMarginViaDelta(-int256(liquidatorRewardValue));

        /// @dev pass position._liquidity to ensure all of the liqudity is burnt

        IVAMM(vammAddress).burn(params.owner, params.tickLower, params.tickUpper, position._liquidity);

        /// @audit what if unwind fails, should ideally be a no-op
        unwindPosition(params.owner, params.tickLower, params.tickUpper);

        IERC20Minimal(underlyingToken).transferFrom(address(this), msg.sender, liquidatorRewardValue);
        
    }

    /// @inheritdoc IMarginEngine
    function liquidateTrader(address traderAddress) external checkCurrentTimestampTermEndTimestampDelta override {

        /// @dev can only happen before maturity, this is checked when an unwind is triggered which in turn triggers a swap which checks for this condition

        require(traderAddress!=fcm, "not FCM");
        
        Trader.Info storage trader = traders[traderAddress];
            
        bool isLiquidatable = MarginCalculator.isLiquidatableTrader(
            MarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestampWad: termStartTimestampWad,
                termEndTimestampWad: termEndTimestampWad,
                isLM: true,
                historicalApyWad: getHistoricalApy()
            }),
            trader.margin,
            marginCalculatorParameters
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }
        
        uint256 liquidatorRewardValue = PRBMathUD60x18.mul(
            uint256(trader.margin),
            liquidatorReward
        );

        trader.updateMarginViaDelta(-int256(liquidatorRewardValue));
        
        unwindTrader(traderAddress, trader.variableTokenBalance);

        IERC20Minimal(underlyingToken).transferFrom(address(this), msg.sender, liquidatorRewardValue);

    }
    
    function checkPositionMarginRequirementSatisfied(
            address recipient,
            int24 tickLower,
            int24 tickUpper,
            uint128 amount
        ) internal {

        (, int24 tick, ) = IVAMM(vammAddress).vammVars();
        updatePositionTokenBalancesAndAccountForFees(recipient, tickLower, tickUpper);
        Position.Info storage position = positions.get(recipient, tickLower, tickUpper);
        
        if (position.margin < int256(minMarginToIncentiviseLiquidators)) {
            revert("not enough to incentivise");
        }
        
        uint128 amountTotal = LiquidityMath.addDelta(position._liquidity, int128(amount));
        
        int256 marginRequirement = int256(MarginCalculator.getPositionMarginRequirement(
            MarginCalculator.PositionMarginRequirementParams({
                owner: recipient,
                tickLower: tickLower,
                tickUpper: tickUpper,
                isLM: false,
                currentTick: tick,
                termStartTimestampWad: termStartTimestampWad,
                termEndTimestampWad: termEndTimestampWad,
                liquidity: amountTotal,
                fixedTokenBalance: position.fixedTokenBalance,
                variableTokenBalance: position.variableTokenBalance, 
                variableFactorWad: IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad),
                historicalApyWad: getHistoricalApy()
            }), marginCalculatorParameters
        ));
   
        if (marginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePositionPostVAMMInducedMintBurn(IVAMM.ModifyPositionParams memory params) external override {

        /// @dev this function can only be called by the vamm
        require(msg.sender==vammAddress, "only vamm");    
        updatePositionTokenBalancesAndAccountForFees(params.owner, params.tickLower, params.tickUpper);
        /// @audit position is retreived from storage twice: once in the updatePositionTokenBalancesAndAccountForFees, once below

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);
        position.updateLiquidity(params.liquidityDelta);
        
        if (params.liquidityDelta>0) {
            uint256 variableFactorWad = IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad);
            checkPositionMarginAboveRequirement(params, position.margin, position._liquidity, position.fixedTokenBalance, position.variableTokenBalance, variableFactorWad);
        }

    }

    function updatePositionPostVAMMInducedSwap(address owner, int24 tickLower, int24 tickUpper, int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred, int24 currentTick) external override {
        /// @dev this function can only be called by the vamm following a swap    
        /// @audit turn into a modifier
        require(msg.sender==vammAddress, "only vamm");

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
                    historicalApyWad: getHistoricalApy()
                });

        int256 positionMarginRequirement = int256(
            MarginCalculator.getPositionMarginRequirement(marginReqParams, marginCalculatorParameters)
        );

        if (positionMarginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }

    }
    
    /// @inheritdoc IMarginEngine
    function updateTraderPostVAMMInducedSwap(address recipient, int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred) external override {

        /// @dev this function can only be called by the vamm following a swap    
        /// @audit turn into a modifier
        require(msg.sender==vammAddress, "only vamm");
        
        Trader.Info storage trader = traders[recipient];

        if (trader.margin < int256(minMarginToIncentiviseLiquidators)) {
            revert("not enough to incentivise");
        }

        if (cumulativeFeeIncurred > 0) {
            trader.updateMarginViaDelta(-int256(cumulativeFeeIncurred));
        }

        trader.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);

        int256 marginRequirement = int256(MarginCalculator.getTraderMarginRequirement(
            MarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestampWad: termStartTimestampWad,
                termEndTimestampWad: termEndTimestampWad,
                isLM: false,
                historicalApyWad: getHistoricalApy()
            }), marginCalculatorParameters
        ));

        if (marginRequirement > trader.margin) {
            revert MarginRequirementNotMet();
        }
    }

    function updatePositionTokenBalancesAndAccountForFees(
        address owner,
        int24 tickLower,
        int24 tickUpper) internal {

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        (, int24 tick, ) = IVAMM(vammAddress).vammVars();
        (int256 fixedTokenGrowthInsideX128, int256 variableTokenGrowthInsideX128, uint256 feeGrowthInsideX128) = IVAMM(vammAddress).computeGrowthInside(tickLower, tickUpper, tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
        uint256 feeDelta = position.calculateFeeDelta(feeGrowthInsideX128);

        position.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInsideX128, variableTokenGrowthInsideX128);
        /// @dev collect fees
        position.updateMarginViaDelta(int256(feeDelta));
        position.updateFeeGrowthInside(feeGrowthInsideX128);
    
    }
    
    /// @notice Check if the position margin is above the Initial Margin Requirement
    /// @dev Reverts if position's margin is below the requirement
    /// @param params Position owner, position tickLower, position tickUpper, _
    /// @param updatedMarginWouldBe Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param positionLiquidity Current liquidity supplied by the position
    /// @param positionFixedTokenBalance Fixed token balance of a position since the last mint/burn/poke
    /// @param positionVariableTokenBalance Variable token balance of a position since the last mint/burn/poke
    /// @param variableFactorWad Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev multiplied by (time in seconds since IRS AMM inception / number of seconds in a year)
    function checkPositionMarginAboveRequirement(
        IMarginEngine.ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactorWad
    ) internal view {

        (, int24 tick, ) = IVAMM(vammAddress).vammVars();

        MarginCalculator.PositionMarginRequirementParams
            memory marginReqParams = MarginCalculator
                .PositionMarginRequirementParams({
                    owner: params.owner,
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    isLM: false,
                    currentTick: tick,
                    termStartTimestampWad: termStartTimestampWad,
                    termEndTimestampWad: termEndTimestampWad,
                    liquidity: positionLiquidity,
                    fixedTokenBalance: positionFixedTokenBalance,
                    variableTokenBalance: positionVariableTokenBalance,
                    variableFactorWad: variableFactorWad,
                    historicalApyWad: getHistoricalApy()
                });

        int256 positionMarginRequirement = int256(
            MarginCalculator.getPositionMarginRequirement(marginReqParams, marginCalculatorParameters)
        );

        if (updatedMarginWouldBe <= positionMarginRequirement) {
            revert MarginLessThanMinimum();
        }
    }

    /// @notice Check if the trader margin is above the Initial Margin Requirement
    /// @dev Reverts if trader's margin is below the requirement
    /// @param updatedMarginWouldBe Amount of margin supporting the trader following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param fixedTokenBalance Current fixed token balance of a trader
    /// @param variableTokenBalance Current variable token balance of a trader
    /// @param isTraderSettled Is the Trader settled, i.e. has the trader settled their IRS cashflows post IRS AMM maturity
    /// @dev Trader's margin cannot be updated unless the trader is settled
    /// @dev If the current block timestamp is higher than the term end timestamp of the IRS AMM then the trader needs to be settled to be able to update their margin
    /// @dev If the AMM has already expired and the trader is settled then the trader can withdraw their margin
    function checkTraderMarginCanBeUpdated(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isTraderSettled
    ) internal view {

        if (Time.blockTimestampScaled() >= termEndTimestampWad) {
            if (!isTraderSettled) {
                revert TraderNotSettled();
            }
            if (updatedMarginWouldBe < 0) {
                revert WithdrawalExceedsCurrentMargin();
            }
        } else {
            checkTraderMarginAboveRequirement(
                updatedMarginWouldBe,
                fixedTokenBalance,
                variableTokenBalance
            );
        }
    }

    /// @notice Check if the position margin can be updated
    /// @param params Position owner, position tickLower, position tickUpper, _
    /// @param updatedMarginWouldBe Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param isPositionBurned The precise definition of a burn position is a position which has zero active liquidity in the vAMM and has settled the IRS cashflows post AMM maturity
    /// @param positionLiquidity Current liquidity supplied by the position
    /// @param positionFixedTokenBalance Fixed token balance of a position since the last mint/burn/poke
    /// @param positionVariableTokenBalance Variable token balance of a position since the last mint/burn/poke
    /// @param variableFactorWad Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev If the current timestamp is higher than the maturity timestamp of the AMM, then the position needs to be burned (detailed definition above)
    function checkPositionMarginCanBeUpdated(
        IMarginEngine.ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        bool isPositionBurned,
        bool isPositionSettled,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactorWad
    ) internal view {

        /// @dev If the IRS AMM has reached maturity, the only reason why someone would want to update
        /// @dev their margin is to withdraw it completely. If so, the position needs to be both burned
        /// @dev and settled.

        if (Time.blockTimestampScaled() >= termEndTimestampWad) {
            if (!isPositionBurned) {
                revert PositionNotBurned();
            }
            if (!isPositionSettled) {
                revert PositionNotSettled();
            }
            if (updatedMarginWouldBe < 0) {
                revert WithdrawalExceedsCurrentMargin();
            }
        }

        checkPositionMarginAboveRequirement(
            params,
            updatedMarginWouldBe,
            positionLiquidity,
            positionFixedTokenBalance,
            positionVariableTokenBalance,
            variableFactorWad
        );
    }

    /// @notice Check if the trader margin is above the Initial Margin Requirement
    /// @dev Reverts if trader's margin is below the requirement
    /// @param updatedMarginWouldBe Amount of margin supporting the trader following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param fixedTokenBalance Current fixed token balance of a trader
    /// @param variableTokenBalance Current variable token balance of a trader
    function checkTraderMarginAboveRequirement(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance
    ) internal view {

        int256 traderMarginRequirement = int256(
            MarginCalculator.getTraderMarginRequirement(
                MarginCalculator.TraderMarginRequirementParams({
                    fixedTokenBalance: fixedTokenBalance,
                    variableTokenBalance: variableTokenBalance,
                    termStartTimestampWad: termStartTimestampWad,
                    termEndTimestampWad: termEndTimestampWad,
                    isLM: false,
                    historicalApyWad: getHistoricalApy()
                }), marginCalculatorParameters
            )
        );

        if (updatedMarginWouldBe <= traderMarginRequirement) {
            revert MarginLessThanMinimum();
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
    
        /// @audit check if beyond maturity
        /// @audit check if variable token balance is non-zero to conduct the unwind (does not make sense to unwind in that case)
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

                /// @audit sqrtPriceLimitX96 needs to be slightly higher than min

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: owner,
                    isFT: false,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO + 1,
                    isUnwind: true,
                    isTrader: false,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });
                
                // check the outputs are correct
                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = IVAMM(vammAddress).swap(params);
            } else {

                /// @dev get into a Fixed Taker swap (the opposite of LP's current position), hence isFT is set to true in SwapParams
                /// @dev amountSpecified needs to be positive
                /// @dev since the position.variableTokenBalance is already positive, pass position.variableTokenBalance as amountSpecified
                /// @dev since moving from right to left along the virtual amm, sqrtPriceLimit is set to MAX_SQRT_RATIO

                /// @audit sqrtPriceLimitX96 needs to be slightly lower than max

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: owner,
                    isFT: true,
                    amountSpecified: position.variableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO - 1,
                    isUnwind: true,
                    isTrader: false,
                    tickLower: tickLower,
                    tickUpper: tickUpper
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = IVAMM(vammAddress).swap(params);
            }

            if (_cumulativeFeeIncurred > 0) {
                /// @dev update position margin to account for the fees incurred while conducting a swap in order to unwind
                position.updateMarginViaDelta(-int256(_cumulativeFeeIncurred));
            }
            
            /// @dev passes the _fixedTokenBalance and _variableTokenBalance deltas
            position.updateBalancesViaDeltas(_fixedTokenDelta, _variableTokenDelta);

        }
        
    }
    
    /// @notice Unwind a trader in a given market
    /// @param traderAddress The address of the trader to unwind
    /// @param traderVariableTokenBalance Trader variable token balance
    function unwindTrader(
        address traderAddress,
        int256 traderVariableTokenBalance
    ) internal {

        if (traderVariableTokenBalance != 0) {

            int256 _fixedTokenDelta;
            int256 _variableTokenDelta;
            uint256 _cumulativeFeeIncurred;

            bool isFT = traderVariableTokenBalance < 0;

            if (isFT) {

                /// @dev get into a Variable Taker swap (the opposite of trader's current position), hence isFT is set to false in SwapParams
                /// @dev amountSpecified needs to be negative
                /// @dev since the traderVariableTokenBalance for a FixedTaker (about to unwind) is already negative, pass traderVariableTokenBalance as amountSpecified
                /// @dev since moving from left to right along the virtual amm, sqrtPriceLimit is set to MIN_SQRT_RATIO

                /// @audit sqrtPriceLimitX96 needs to be slightly higher than min

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: traderAddress,
                    isFT: false,
                    amountSpecified: traderVariableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO + 1,
                    isUnwind: true,
                    isTrader: true,
                    tickLower: 0,
                    tickUpper: 0
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = IVAMM(vammAddress).swap(params);
            } else {
                
                /// @dev get into a Fixed Taker swap (the opposite of trader's current position), hence isFT is set to true in SwapParams
                /// @dev amountSpecified needs to be positive
                /// @dev since the traderVariableTokenBalance for a VariableTaker (about ot unwind) is already positive, pass traderVariableTokenBalance as amountSpecified
                /// @dev since moving from right to left along the virtual amm, sqrtPriceLimit is set to MAX_SQRT_RATIO

                /// @audit sqrtPriceLimitX96 needs to be slightly lower than max

                IVAMM.SwapParams memory params = IVAMM.SwapParams({
                    recipient: traderAddress,
                    isFT: true,
                    amountSpecified: traderVariableTokenBalance,
                    sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO - 1,
                    isUnwind: true,
                    isTrader: true,
                    tickLower: 0,
                    tickUpper: 0
                });

                (_fixedTokenDelta, _variableTokenDelta, _cumulativeFeeIncurred) = IVAMM(vammAddress).swap(params);
            }

            Trader.Info storage trader = traders[traderAddress];

            if (_cumulativeFeeIncurred > 0) {
                trader.updateMarginViaDelta(-int256(_cumulativeFeeIncurred));
            }

            trader.updateBalancesViaDeltas(_fixedTokenDelta, _variableTokenDelta);
    
        }

    }

}