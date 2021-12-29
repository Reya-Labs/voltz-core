// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IAMM.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";

import "./utils/SafeCast.sol";
import "./utils/LowGasSafeMath.sol";

import "./interfaces/IMarginCalculator.sol";
import "./interfaces/amm/IAMMImmutables.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IDeployer.sol";

import "prb-math/contracts/PRBMathUD60x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";

import "./core_libraries/UnwindTraderUnwindPosition.sol";

import "./core_libraries/MarginEngineHelpers.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MarginEngine is IMarginEngine, IAMMImmutables, MarginEngineHelpers, Pausable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);
    
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;
    using Trader for Trader.Info;


    /// @dev liquidatorReward is the percentage of the margin (of a liquidated trader/liquidity provider) that is sent to the liquidator 
    /// @dev following a successful liquidation that results in a trader/position unwind, example value:  2 * 10**15;
    // todo: add override
    uint256 public liquidatorReward;

    /// @inheritdoc IMarginEngine
    IAMM public override amm;
    /// @inheritdoc IAMMImmutables
    address public override immutable underlyingToken;
    /// @inheritdoc IAMMImmutables
    uint256 public override immutable termStartTimestamp;
    /// @inheritdoc IAMMImmutables
    uint256 public override immutable termEndTimestamp;
    /// @inheritdoc IAMMImmutables
    IMarginCalculator public override immutable calculator;
    /// @inheritdoc IAMMImmutables
    IRateOracle public override immutable rateOracle;
    /// @inheritdoc IAMMImmutables
    bytes32 public override immutable rateOracleId;
    /// @inheritdoc IAMMImmutables
    address public override immutable factory;

    mapping(bytes32 => Position.Info) internal positions; // AB: why internal?
    /// @inheritdoc IMarginEngine
    mapping(address => Trader.Info) public override traders;

    constructor() Pausable() {  
        address ammAddress;      
        (ammAddress) = IDeployer(msg.sender).marginEngineParameters();
        amm = IAMM(ammAddress);

        // todo: AMM never changes. We should enforce this invariant (most simply, only allow it to be set once?), and once we do we can cache all AMM properties (underlyingToken, rateOracleId, termStartTimestamp, termEndTimestamp, ... ) indefinitely here to save gas and simplify code.
        underlyingToken = amm.underlyingToken(); // immutable in AMM therefore safe to cache forever
        factory = amm.factory(); // immutable in AMM therefore safe to cache forever
        rateOracleId = amm.rateOracleId(); // immutable in AMM therefore safe to cache forever
        termStartTimestamp = amm.termStartTimestamp(); // immutable in AMM therefore safe to cache forever
        termEndTimestamp = amm.termEndTimestamp(); // immutable in AMM therefore safe to cache forever
        calculator = amm.calculator(); // immutable in AMM therefore safe to cache forever
        rateOracle = amm.rateOracle(); // immutable in AMM therefore safe to cache forever
    }

    /// Only the position/trade owner can update the position/trade margin
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
        if (termEndTimestamp > Time.blockTimestampScaled()) {
            revert CannotSettleBeforeMaturity();
        }
        _;
    }

    modifier onlyFactoryOwner() {
        require(msg.sender == IFactory(factory).owner());
        _;
    }

    // todo: override
    function setLiquidatorReward(uint256 _liquidatorReward) external onlyFactoryOwner {
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
            IERC20Minimal(underlyingToken).transferFrom(_account, address(amm), uint256(_marginDelta));
        } else {
            IERC20Minimal(underlyingToken).transferFrom(address(amm), _account, uint256(-_marginDelta));
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external nonZeroDelta(marginDelta) override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        if (params.owner != msg.sender) {
            revert OnlyOwnerCanUpdatePosition();
        }

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        int256 updatedMarginWouldBe = position.margin + marginDelta;
        
        uint256 variableFactor = amm.rateOracle().variableFactor(false, amm.termStartTimestamp(), amm.termEndTimestamp());
        
        // duplicate code (put into a function)
        (, int24 tick, ) = amm.vamm().slot0();
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(params.tickLower, params.tickUpper, tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        checkPositionMarginCanBeUpdated(params, updatedMarginWouldBe, position.isBurned, position.isSettled, position._liquidity, position.fixedTokenBalance, position.variableTokenBalance, variableFactor, address(amm)); 

        position.updateMargin(marginDelta);

        transferMargin(params.owner, marginDelta);
    }
    
    /// @inheritdoc IMarginEngine
    function updateTraderMargin(int256 marginDelta) public nonZeroDelta(marginDelta) override {

        // make external?, impacts the tests
        Trader.Info storage trader = traders[msg.sender];

        int256 updatedMarginWouldBe = trader.margin + marginDelta;
        
        checkTraderMarginCanBeUpdated(updatedMarginWouldBe, trader.fixedTokenBalance, trader.variableTokenBalance, trader.isSettled, address(amm));

        trader.updateMargin(marginDelta);

        transferMargin(msg.sender, marginDelta);
    }
    
    /// @inheritdoc IMarginEngine
    function settlePosition(ModifyPositionParams memory params) external onlyAfterMaturity override whenNotPaused onlyAfterMaturity {

        if (params.owner != msg.sender) {
            revert OnlyOwnerCanUpdatePosition();
        }

        Tick.checkTicks(params.tickLower, params.tickUpper);

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper); 

        // @dev position can only be settled if it is burned
        require(position.isBurned);

        (, int24 tick, ) = amm.vamm().slot0();
        
        // AB: theoretically can directly call vamm from margin engine
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(params.tickLower, params.tickUpper, tick);
        
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);

        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, amm.termStartTimestamp(), amm.termEndTimestamp(), amm.rateOracle().variableFactor(true, amm.termStartTimestamp(), amm.termEndTimestamp()));

        position.updateBalances(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMargin(settlementCashflow);
        position.settlePosition();
    }
    
    /// @inheritdoc IMarginEngine
    function settleTrader() external override whenNotPaused onlyAfterMaturity {

        Trader.Info storage trader = traders[msg.sender];    
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, amm.termStartTimestamp(), amm.termEndTimestamp(), amm.rateOracle().variableFactor(true, amm.termStartTimestamp(), amm.termEndTimestamp()));

        trader.updateBalances(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMargin(settlementCashflow);
        trader.settleTrader();
    }

    /// @inheritdoc IMarginEngine
    function liquidatePosition(ModifyPositionParams memory params) external override {

        Tick.checkTicks(params.tickLower, params.tickUpper);
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        (, int24 tick, ) = amm.vamm().slot0();
        
        // code duplication
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(params.tickLower, params.tickUpper, tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);

        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        bool isLiquidatable = calculator.isLiquidatablePosition(
            IMarginCalculator.PositionMarginRequirementParams({
                owner: params.owner,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                isLM: true,
                currentTick: tick,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                liquidity: position._liquidity,
                fixedTokenBalance: position.fixedTokenBalance,
                variableTokenBalance: position.variableTokenBalance,
                variableFactor: amm.rateOracle().variableFactor(false, termStartTimestamp, termEndTimestamp),
                rateOracleId: amm.rateOracleId(),
                historicalApy: amm.rateOracle().getHistoricalApy()
            }),
            position.margin
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        uint256 liquidatorRewardValue = PRBMathUD60x18.mul(uint256(position.margin), liquidatorReward);

        position.updateMargin(-int256(liquidatorReward));

        amm.burn(params.tickLower, params.tickUpper, position._liquidity); // burn all liquidity

        IERC20Minimal(underlyingToken).transferFrom(address(amm ), msg.sender, liquidatorRewardValue);
        
    }

    /// @inheritdoc IMarginEngine
    function liquidateTrader(address traderAddress) external override {
        
        Trader.Info storage trader = traders[traderAddress];
            
        bool isLiquidatable = calculator.isLiquidatableTrader(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                isLM: true,
                rateOracleId: amm.rateOracleId(),
                historicalApy: amm.rateOracle().getHistoricalApy()
            }),
            trader.margin
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        (uint256 liquidatorRewardValue, int256 updatedMargin) = calculateLiquidatorRewardAndUpdatedMargin(trader.margin, liquidatorReward);

        trader.updateMargin(updatedMargin);

        int256 notional = trader.variableTokenBalance > 0 ? trader.variableTokenBalance : -trader.variableTokenBalance;
        
        UnwindTraderUnwindPosition.unwindTrader(address(amm), traderAddress, notional);

        IERC20Minimal(underlyingToken).transferFrom(address(amm), msg.sender, liquidatorRewardValue);

    }

    /// @inheritdoc IMarginEngine
    function checkPositionMarginRequirementSatisfied(
            address recipient,
            int24 tickLower,
            int24 tickUpper,
            uint128 amount
        ) external override {
        
        Position.Info storage position = positions.get(recipient, tickLower, tickUpper);
        
        uint128 amountTotal = LiquidityMath.addDelta(position._liquidity, int128(amount));
        
        // duplicate code
        (, int24 tick, ) = amm.vamm().slot0();
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(tickLower, tickUpper, tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        int256 marginRequirement = int256(calculator.getPositionMarginRequirement(
            IMarginCalculator.PositionMarginRequirementParams({
                owner: recipient,
                tickLower: tickLower,
                tickUpper: tickUpper,
                isLM: false,
                currentTick: tick,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                liquidity: amountTotal,
                fixedTokenBalance: position.fixedTokenBalance,
                variableTokenBalance: position.variableTokenBalance, 
                variableFactor: amm.rateOracle().variableFactor(false, termStartTimestamp, termEndTimestamp),
                rateOracleId: amm.rateOracleId(),
                historicalApy: amm.rateOracle().getHistoricalApy()
            })
        ));
   
        if (marginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePosition(IVAMM.ModifyPositionParams memory params, IVAMM.UpdatePositionVars memory vars) external override {
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);
        position.updateLiquidity(params.liquidityDelta);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(vars.fixedTokenGrowthInside, vars.variableTokenGrowthInside);
        uint256 feeDelta = position.calculateFeeDelta(vars.feeGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateMargin(int256(feeDelta));
        position.updateFixedAndVariableTokenGrowthInside(vars.fixedTokenGrowthInside, vars.variableTokenGrowthInside);
        position.updateFeeGrowthInside(vars.feeGrowthInside);
    }

    /// @inheritdoc IMarginEngine
    function updateTraderBalances(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance, bool isUnwind) external override {
        Trader.Info storage trader = traders[recipient];
        trader.updateBalances(fixedTokenBalance, variableTokenBalance);

        int256 marginRequirement = int256(calculator.getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:termStartTimestamp,
                termEndTimestamp:termEndTimestamp,
                isLM: false,
                rateOracleId: amm.rateOracleId(),
                historicalApy: amm.rateOracle().getHistoricalApy()
            })
        ));

        if (marginRequirement > trader.margin && !isUnwind) {
            revert MarginRequirementNotMet();
        }
    }

    /// @inheritdoc IMarginEngine
    function unwindPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external override returns(int256 _fixedTokenBalance, int256 _variableTokenBalance) {

        // duplicate code
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        (, int24 tick, ) = amm.vamm().slot0();
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(tickLower, tickUpper, tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);
        
        Position.Info memory positionMemory = positions.get(owner, tickLower, tickUpper);

        // can we bring UnwindTraderUnwindPosition in the MarginEngine?
        (_fixedTokenBalance, _variableTokenBalance) = UnwindTraderUnwindPosition.unwindPosition(
            address(amm),
            owner,
            tickLower,
            tickUpper,
            positionMemory
        );

        position.updateBalances(_fixedTokenBalance, _variableTokenBalance);
    }

}