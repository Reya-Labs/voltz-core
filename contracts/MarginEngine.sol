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

contract MarginEngine is IMarginEngine, IAMMImmutables {
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);
    
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    using Trader for mapping(bytes32 => Trader.Info);
    using Trader for Trader.Info;

    /// @dev LIQUIDATOR_REWARD is the percentage of the margin (of a liquidated trader/liquidity provider) that is sent to the liquidator 
    /// @dev following a successful liquidation that results in a trader/position unwind
    uint256 public constant LIQUIDATOR_REWARD = 2 * 10**15;
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

    /// @inheritdoc IMarginEngine
    mapping(bytes32 => Position.Info) public override positions;
    /// @inheritdoc IMarginEngine
    mapping(bytes32 => Trader.Info) public override traders;

    constructor() {  
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

    // just use onlyFactory
    modifier onlyAMM () {
        require(msg.sender == address(amm));
        _;
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

    /// @dev Transfers funds in from account if _marginDelta is positive, or out to account if _marginDelta is negative
    function transferMargin(address _account, int256 _marginDelta) internal {
        if (_marginDelta > 0) {
            IERC20Minimal(underlyingToken).transferFrom(_account, address(amm), uint256(_marginDelta));
        } else {
            IERC20Minimal(underlyingToken).transferFrom(address(amm), _account, uint256(-_marginDelta));
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external onlyAMM nonZeroDelta(marginDelta) override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        if (params.owner != msg.sender) {
            revert OnlyOwnerCanUpdatePosition();
        }

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        int256 updatedMarginWouldBe = position.margin + marginDelta;
        
        uint256 variableFactor = rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp);
        
        // make sure 0,0 is fixed
        MarginEngineHelpers.checkPositionMarginCanBeUpdated(params, updatedMarginWouldBe, position.isBurned, position._liquidity, 0, 0, variableFactor, address(amm)); 

        position.updateMargin(marginDelta);

        transferMargin(params.owner, marginDelta);
    }
    
    /// @inheritdoc IMarginEngine
    function updateTraderMargin(address recipient, int256 marginDelta) public nonZeroDelta(marginDelta) override {
        // got rid of onlyAMM for now 

        // make external?, impacts the tests

        if (recipient != msg.sender) {
            revert OnlyOwnerCanUpdatePosition();
        }
        
        Trader.Info storage trader = traders.get(recipient);

        int256 updatedMarginWouldBe = trader.margin + marginDelta;
        
        MarginEngineHelpers.checkTraderMarginCanBeUpdated(updatedMarginWouldBe, trader.fixedTokenBalance, trader.variableTokenBalance, trader.isSettled, address(amm));

        trader.updateMargin(marginDelta);

        transferMargin(recipient, marginDelta);
    }
    
    /// @inheritdoc IMarginEngine
    function settlePosition(ModifyPositionParams memory params) onlyAfterMaturity external override onlyAMM {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper); 

        (, int24 tick, ) = amm.vamm().slot0();
        
        // AB: theoretically can directly call vamm from margin engine
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(params.tickLower, params.tickUpper, tick);
        
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);

        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestamp, termEndTimestamp, rateOracle.variableFactor(true, underlyingToken, termStartTimestamp, termEndTimestamp));

        position.updateBalances(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMargin(settlementCashflow);

    }
    
    /// @inheritdoc IMarginEngine
    function settleTrader(address recipient) onlyAfterMaturity external override onlyAMM {

        Trader.Info storage trader = traders.get(recipient);        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, termStartTimestamp, termEndTimestamp, rateOracle.variableFactor(true, underlyingToken, termStartTimestamp, termEndTimestamp));

        trader.updateBalances(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMargin(settlementCashflow);
    }
    
    /// @inheritdoc IMarginEngine
    function liquidatePosition(ModifyPositionParams memory params) onlyAfterMaturity external override {

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
                variableFactor: rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp),
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
            }),
            position.margin
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        uint256 liquidatorReward = PRBMathUD60x18.mul(uint256(position.margin), LIQUIDATOR_REWARD);

        position.updateMargin(-int256(liquidatorReward));

        amm.burn(params.tickLower, params.tickUpper, position._liquidity); // burn all liquidity

        IERC20Minimal(underlyingToken).transferFrom(address(amm ), msg.sender, liquidatorReward);
        
    }

    /// @inheritdoc IMarginEngine
    function liquidateTrader(address traderAddress) external override {
        
        Trader.Info storage trader = traders.get(traderAddress);
            
        bool isLiquidatable = calculator.isLiquidatableTrader(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                isLM: true,
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
            }),
            trader.margin
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        (uint256 liquidatorReward, int256 updatedMargin) = MarginEngineHelpers.calculateLiquidatorRewardAndUpdatedMargin(trader.margin, LIQUIDATOR_REWARD);

        trader.updateMargin(updatedMargin);

        int256 notional = trader.variableTokenBalance > 0 ? trader.variableTokenBalance : -trader.variableTokenBalance;
        
        UnwindTraderUnwindPosition.unwindTrader(address(amm), traderAddress, notional);

        IERC20Minimal(underlyingToken).transferFrom(address(amm), msg.sender, liquidatorReward);

    }

    /// @inheritdoc IMarginEngine
    function checkPositionMarginRequirementSatisfied(
            address recipient,
            int24 tickLower,
            int24 tickUpper,
            uint128 amount
        ) external override {
        
        Position.Info memory position = positions.get(recipient, tickLower, tickUpper);
        uint128 amountTotal = amount + position._liquidity;
        
        (, int24 tick,) = amm.vamm().slot0();
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
                fixedTokenBalance: 0, // todo: should not be set to 0, fix
                variableTokenBalance: 0, // todo: should not be set to 0, fix
                variableFactor: rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp),
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
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
    function updateTraderBalances(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance) external override {
        Trader.Info storage trader = traders.get(recipient);
        trader.updateBalances(fixedTokenBalance, variableTokenBalance);

        int256 marginRequirement = int256(calculator.getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:termStartTimestamp,
                termEndTimestamp:termEndTimestamp,
                isLM: false,
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
            })
        ));

        // AB: revert if margin requirement is satisfied (unless it is a liquidation?)
        if (marginRequirement > trader.margin) {
            revert MarginRequirementNotMet();
        }
    }

    /// @inheritdoc IMarginEngine
    function unwindPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external override returns(int256 _fixedTokenBalance, int256 _variableTokenBalance) {
        Position.Info memory positionMemory = positions.get(owner, tickLower, tickUpper);

        (_fixedTokenBalance, _variableTokenBalance) = UnwindTraderUnwindPosition.unwindPosition(
            address(amm),
            owner,
            tickLower,
            tickUpper,
            positionMemory
        );

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        position.updateBalances(_fixedTokenBalance, _variableTokenBalance);
    }

}