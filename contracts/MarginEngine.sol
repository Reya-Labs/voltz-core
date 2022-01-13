// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";
import "./core_libraries/MarginCalculator.sol";

import "./utils/SafeCast.sol";
import "./utils/LowGasSafeMath.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IDeployer.sol";

import "prb-math/contracts/PRBMathUD60x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MarginEngine is IMarginEngine, Pausable {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);
    
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;
    using Trader for Trader.Info;

    /// @dev Must be the Factory owner
    error NotFactoryOwner();

    /// @dev liquidatorReward is the percentage of the margin (of a liquidated trader/liquidity provider) that is sent to the liquidator 
    /// @dev following a successful liquidation that results in a trader/position unwind, example value:  2 * 10**15;
    uint256 public override liquidatorReward;
    /// @inheritdoc IMarginEngine
    address public override immutable underlyingToken;
    /// @inheritdoc IMarginEngine
    uint256 public override immutable termStartTimestamp;
    /// @inheritdoc IMarginEngine
    uint256 public override immutable termEndTimestamp;
    /// @inheritdoc IMarginEngine
    IRateOracle public override immutable rateOracle;
    /// @inheritdoc IMarginEngine
    bytes32 public override rateOracleId;
    /// @inheritdoc IMarginEngine
    address public override factory;

    address public override fcm; // full collateralisation module

    mapping(bytes32 => Position.Info) internal positions;
    /// @inheritdoc IMarginEngine
    mapping(address => Trader.Info) public override traders;

    IVAMM public override vamm;

    MarginCalculatorParameters internal marginCalculatorParameters;

    constructor() Pausable() {  

        (
            factory,
            underlyingToken,
            rateOracleId,
            termStartTimestamp,
            termEndTimestamp
        ) = IDeployer(msg.sender).marginEngineParameters();

        address rateOracleAddress = IFactory(factory).getRateOracleAddress(
            rateOracleId
        );

        rateOracle = IRateOracle(rateOracleAddress);

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
        if (msg.sender != IFactory(factory).owner()) {
            revert NotFactoryOwner();
        }
        _;
    }

    // add override
    /// @notice Set the per-oracle MarginCalculatorParameters
    /// @param _marginCalculatorParameters the MarginCalculatorParameters to set
    function setMarginCalculatorParameters(
        MarginCalculatorParameters memory _marginCalculatorParameters
    ) external onlyFactoryOwner {
        marginCalculatorParameters = _marginCalculatorParameters;
    }

    function setVAMM(address _vAMMAddress) external override onlyFactoryOwner {
        vamm = IVAMM(_vAMMAddress);
    }

    function setFCM(address _fcm) external override onlyFactoryOwner {
        fcm = _fcm;
    }

    function collectProtocol(address recipient, uint256 amount)
        external
        override
        onlyFactoryOwner{

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
    
    function setLiquidatorReward(uint256 _liquidatorReward) external override onlyFactoryOwner {
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
            IERC20Minimal(underlyingToken).transferFrom(address(this), _account, uint256(-_marginDelta));
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external nonZeroDelta(marginDelta) override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        if (marginDelta < 0) {
            if (params.owner != msg.sender) {
                revert OnlyOwnerCanUpdatePosition();
            }
        }
        
        uint256 variableFactor = rateOracle.variableFactor(termStartTimestamp, termEndTimestamp);
        updatePositionTokenBalances(params.owner, params.tickLower, params.tickUpper);
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  
        int256 updatedMarginWouldBe = position.margin + marginDelta;

        checkPositionMarginCanBeUpdated(params, updatedMarginWouldBe, position._liquidity==0, position.isSettled, position._liquidity, position.fixedTokenBalance, position.variableTokenBalance, variableFactor); 

        position.updateMargin(marginDelta);

        transferMargin(params.owner, marginDelta);
    }
    
    /// @inheritdoc IMarginEngine
    function updateTraderMargin(address traderAddress, int256 marginDelta) external nonZeroDelta(marginDelta) override {
        
        if (marginDelta < 0) {
            if (traderAddress != msg.sender) {
                revert OnlyOwnerCanUpdatePosition();
            }
        }

        Trader.Info storage trader = traders[traderAddress];

        int256 updatedMarginWouldBe = trader.margin + marginDelta;
        
        checkTraderMarginCanBeUpdated(updatedMarginWouldBe, trader.fixedTokenBalance, trader.variableTokenBalance, trader.isSettled);

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

        // @dev position can only be settled if it is burned and not settled
        require(position._liquidity==0, "fully burned");
        require(!position.isSettled, "already settled");

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestamp, termEndTimestamp, rateOracle.variableFactor(termStartTimestamp, termEndTimestamp));

        position.updateBalances(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMargin(settlementCashflow);
        position.settlePosition();
    }
    
    /// @inheritdoc IMarginEngine
    function settleTrader() external override whenNotPaused onlyAfterMaturity {

        Trader.Info storage trader = traders[msg.sender];

        require(!trader.isSettled, "not settled");

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, termStartTimestamp, termEndTimestamp, rateOracle.variableFactor(termStartTimestamp, termEndTimestamp));

        trader.updateBalances(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMargin(settlementCashflow);
        trader.settleTrader();
    }

    /// @inheritdoc IMarginEngine
    function liquidatePosition(ModifyPositionParams memory params) external override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        (, int24 tick, ) = vamm.vammVars();
        updatePositionTokenBalances(params.owner, params.tickLower, params.tickUpper);
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        bool isLiquidatable = MarginCalculator.isLiquidatablePosition(
            MarginCalculator.PositionMarginRequirementParams({
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
                variableFactor: rateOracle.variableFactor(termStartTimestamp, termEndTimestamp),
                historicalApy: rateOracle.getHistoricalApy()
            }),
            position.margin,
            marginCalculatorParameters
        );

        if (!isLiquidatable) {
            revert CannotLiquidate();
        }

        uint256 liquidatorRewardValue = PRBMathUD60x18.mul(uint256(position.margin), liquidatorReward);

        position.updateMargin(-int256(liquidatorReward));

        vamm.burn(params.tickLower, params.tickUpper, position._liquidity); // burn all liquidity

        IERC20Minimal(underlyingToken).transferFrom(address(this), msg.sender, liquidatorRewardValue);
        
    }

    /// @inheritdoc IMarginEngine
    function liquidateTrader(address traderAddress) external override {

        require(traderAddress!=fcm, "not FCM");
        
        Trader.Info storage trader = traders[traderAddress];
            
        bool isLiquidatable = MarginCalculator.isLiquidatableTrader(
            MarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                isLM: true,
                historicalApy: rateOracle.getHistoricalApy()
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

        int256 updatedMargin = trader.margin - int256(liquidatorRewardValue);


        trader.updateMargin(updatedMargin);

        int256 notional = trader.variableTokenBalance > 0 ? trader.variableTokenBalance : -trader.variableTokenBalance;
        
        unwindTrader(traderAddress, notional);

        IERC20Minimal(underlyingToken).transferFrom(address(this), msg.sender, liquidatorRewardValue);

    }

    /// @inheritdoc IMarginEngine
    function checkPositionMarginRequirementSatisfied(
            address recipient,
            int24 tickLower,
            int24 tickUpper,
            uint128 amount
        ) external override {
        
        (, int24 tick, ) = vamm.vammVars();
        updatePositionTokenBalances(recipient, tickLower, tickUpper);
        Position.Info storage position = positions.get(recipient, tickLower, tickUpper);
        uint128 amountTotal = LiquidityMath.addDelta(position._liquidity, int128(amount));
        
        int256 marginRequirement = int256(MarginCalculator.getPositionMarginRequirement(
            MarginCalculator.PositionMarginRequirementParams({
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
                variableFactor: rateOracle.variableFactor(termStartTimestamp, termEndTimestamp),
                historicalApy: rateOracle.getHistoricalApy()
            }), marginCalculatorParameters
        ));
   
        if (marginRequirement > position.margin) {
            revert MarginRequirementNotMet();
        }
    }

    /// @inheritdoc IMarginEngine
    function updatePosition(IVAMM.ModifyPositionParams memory params, IVAMM.UpdatePositionVars memory vars) external override {

        /// @dev this function can only be called by the vamm following a swap    
        require(msg.sender==address(vamm), "only vamm");        

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

        /// @dev this function can only be called by the vamm following a swap    
        require(msg.sender==address(vamm), "only vamm");
        
        Trader.Info storage trader = traders[recipient];
        trader.updateBalances(fixedTokenBalance, variableTokenBalance);

        int256 marginRequirement = int256(MarginCalculator.getTraderMarginRequirement(
            MarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:termStartTimestamp,
                termEndTimestamp:termEndTimestamp,
                isLM: false,
                historicalApy: rateOracle.getHistoricalApy()
            }), marginCalculatorParameters
        ));

        if (marginRequirement > trader.margin && !isUnwind) {
            revert MarginRequirementNotMet();
        }
    }

    function updatePositionTokenBalances(
        address owner,
        int24 tickLower,
        int24 tickUpper) internal {

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        (, int24 tick, ) = vamm.vammVars();
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = vamm.computePositionFixedAndVariableGrowthInside(tickLower, tickUpper, tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

    }
    
    /// @inheritdoc IMarginEngine
    function unwindPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external override returns(int256 _fixedTokenBalance, int256 _variableTokenBalance) {

        /// @dev this function can only be called by the vamm following a swap    
        require(msg.sender==address(vamm), "only vamm");

        updatePositionTokenBalances(owner, tickLower, tickUpper);
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        Tick.checkTicks(tickLower, tickUpper);

        if (position.variableTokenBalance == 0) {
            revert PositionNetZero();
        }

        // initiate a swap
        bool isFT = position.fixedTokenBalance > 0;

        if (isFT) {
            // get into a VT swap
            // variableTokenBalance is negative

            IVAMM.SwapParams memory params = IVAMM.SwapParams({
                recipient: owner,
                isFT: !isFT,
                amountSpecified: position.variableTokenBalance, // check the sign
                sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
                isUnwind: true,
                isTrader: false
            });

            (_fixedTokenBalance, _variableTokenBalance) = vamm.swap(params); // check the outputs are correct
        } else {
            // get into an FT swap
            // variableTokenBalance is positive

            IVAMM.SwapParams memory params = IVAMM.SwapParams({
                recipient: owner,
                isFT: isFT,
                amountSpecified: position.variableTokenBalance,
                sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
                isUnwind: true,
                isTrader: false
            });

            (_fixedTokenBalance, _variableTokenBalance) = vamm.swap(params);
        }

        position.updateBalances(_fixedTokenBalance, _variableTokenBalance);
    }

    /// @notice Check if the position margin is above the Initial Margin Requirement
    /// @dev Reverts if position's margin is below the requirement
    /// @param params Position owner, position tickLower, position tickUpper, _
    /// @param updatedMarginWouldBe Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param positionLiquidity Current liquidity supplied by the position
    /// @param positionFixedTokenBalance Fixed token balance of a position since the last mint/burn/poke
    /// @param positionVariableTokenBalance Variable token balance of a position since the last mint/burn/poke
    /// @param variableFactor Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev multiplied by (time in seconds since IRS AMM inception / number of seconds in a year)
    function checkPositionMarginAboveRequirement(
        IMarginEngine.ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor
    ) internal view {

        (, int24 tick, ) = vamm.vammVars();

        MarginCalculator.PositionMarginRequirementParams
            memory marginReqParams = MarginCalculator
                .PositionMarginRequirementParams({
                    owner: params.owner,
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    isLM: false,
                    currentTick: tick,
                    termStartTimestamp: termStartTimestamp,
                    termEndTimestamp: termEndTimestamp,
                    liquidity: positionLiquidity,
                    fixedTokenBalance: positionFixedTokenBalance,
                    variableTokenBalance: positionVariableTokenBalance,
                    variableFactor: variableFactor,
                    historicalApy: rateOracle.getHistoricalApy()
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

        if (Time.blockTimestampScaled() >= termEndTimestamp) {
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
    /// @param variableFactor Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev If the current timestamp is higher than the maturity timestamp of the AMM, then the position needs to be burned (detailed definition above)
    function checkPositionMarginCanBeUpdated(
        IMarginEngine.ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        bool isPositionBurned,
        bool isPositionSettled,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor
    ) internal view {

        /// @dev If the AMM has reached maturity, the only reason why someone would want to update
        // their margin is to withdraw it completely. If so, the position needs to be both burned
        // and settled.

        if (Time.blockTimestampScaled() >= termEndTimestamp) {
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
            variableFactor
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
                    termStartTimestamp: termStartTimestamp,
                    termEndTimestamp: termEndTimestamp,
                    isLM: false,
                    historicalApy: rateOracle.getHistoricalApy()
                }), marginCalculatorParameters
            )
        );

        if (updatedMarginWouldBe <= traderMarginRequirement) {
            revert MarginLessThanMinimum();
        }
    }

    /// @notice Unwind a trader in a given market
    /// @param traderAddress The address of the trader to unwind
    /// @param notional The number of tokens to unwind (the opposite of the trade, so positive – variable tokens – for fixed takers, and negative – fixed tokens - for variable takers, such that fixed tokens + variable tokens = 0)
    function unwindTrader(
        address traderAddress,
        int256 notional
    ) internal {

        bool isFT = notional > 0;

        if (isFT) {
            // get into a VT swap
            // notional is positive
            IVAMM.SwapParams memory params = IVAMM.SwapParams({
                recipient: traderAddress,
                isFT: !isFT,
                amountSpecified: -notional,
                sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
                isUnwind: true,
                isTrader: true
            });

            vamm.swap(params);
        } else {
            // get into an FT swap
            // notional is negative

            IVAMM.SwapParams memory params = IVAMM.SwapParams({
                recipient: traderAddress,
                isFT: isFT,
                amountSpecified: notional,
                sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
                isUnwind: true,
                isTrader: true
            });

            vamm.swap(params);
        }
    }

}