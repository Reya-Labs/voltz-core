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

import "hardhat/console.sol";
import "./interfaces/IMarginCalculator.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IDeployer.sol";

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./core_libraries/FixedAndVariableMath.sol";

import "./core_libraries/UnwindTraderUnwindPosition.sol";

contract MarginEngine is IMarginEngine {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
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
    /// @inheritdoc IMarginEngine
    mapping(bytes32 => Position.Info) public override positions;
    /// @inheritdoc IMarginEngine
    mapping(bytes32 => Trader.Info) public override traders;

    constructor() {  
        address ammAddress;      
        (ammAddress) = IDeployer(msg.sender).marginEngineParameters();
        amm = IAMM(ammAddress);
    }

    modifier onlyAMM () {
        require(msg.sender == address(amm));
        _;
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
        ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor
       )  internal view {
            
        IMarginCalculator.PositionMarginRequirementParams memory marginReqParams = IMarginCalculator.PositionMarginRequirementParams(
            {
                owner: params.owner,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                isLM: false,
                currentTick: amm.getSlot0().tick,
                termStartTimestamp: amm.termStartTimestamp(),
                termEndTimestamp: amm.termEndTimestamp(),
                liquidity: positionLiquidity,
                fixedTokenBalance: positionFixedTokenBalance,
                variableTokenBalance: positionVariableTokenBalance,
                variableFactor: variableFactor,
                rateOracleId: amm.rateOracleId(),
                twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
            }
        );

        int256 positionMarginRequirement = int256(amm.calculator().getPositionMarginRequirement(marginReqParams));             

        require(updatedMarginWouldBe > positionMarginRequirement, "Cannot have less margin than the minimum requirement");
    }

    /// @notice Check if the trader margin is above the Initial Margin Requirement
    /// @dev Reverts if trader's margin is below the requirement
    /// @param updatedMarginWouldBe Amount of margin supporting the trader following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param fixedTokenBalance Current fixed token balance of a trader
    /// @param variableTokenBalance Current variable token balance of a trader
    function checkTraderMarginAboveRequirement(int256 updatedMarginWouldBe, int256 fixedTokenBalance, int256 variableTokenBalance) internal view {

        int256 traderMarginRequirement = int256(amm.calculator().getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                    fixedTokenBalance: fixedTokenBalance,
                    variableTokenBalance: variableTokenBalance,
                    termStartTimestamp:amm.termStartTimestamp(),
                    termEndTimestamp:amm.termEndTimestamp(),
                    isLM: false,
                    rateOracleId: amm.rateOracleId(),
                    twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
                })
        ));                

        require(updatedMarginWouldBe > traderMarginRequirement, "Cannot have less margin than the minimum requirement");

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
    function checkTraderMarginCanBeUpdated(int256 updatedMarginWouldBe, int256 fixedTokenBalance, int256 variableTokenBalance, bool isTraderSettled) internal view {

        if (Time.blockTimestampScaled() >= amm.termEndTimestamp()) {
            require(isTraderSettled, "Trader's margin cannot be updated unless the trader is settled");

            require(updatedMarginWouldBe>=0, "can't withdraw more than have");

        } else {

            checkTraderMarginAboveRequirement(updatedMarginWouldBe, fixedTokenBalance, variableTokenBalance);
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
        ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        bool isPositionBurned,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor) internal view {

        if (Time.blockTimestampScaled() >= amm.termEndTimestamp()) {
            require(isPositionBurned);
            require(updatedMarginWouldBe>=0, "can't withdraw more than have");
        } else {
            checkPositionMarginAboveRequirement(params, updatedMarginWouldBe, positionLiquidity, positionFixedTokenBalance, positionVariableTokenBalance, variableFactor);
        }

    }


    /// @notice Calculate the liquidator reward and the updated trader margin
    /// @param traderMargin Current margin of the trader
    /// @return liquidatorReward Liquidator Reward as a proportion of the traderMargin
    /// @return updatedMargin Trader margin net the liquidatorReward
    /// @dev liquidatorReward = traderMargin * LIQUIDATOR_REWARD
    /// @dev updatedMargin = traderMargin - liquidatorReward
    function calculateLiquidatorRewardAndUpdatedMargin(int256 traderMargin) internal pure returns (uint256 liquidatorReward, int256 updatedMargin) {

        liquidatorReward = PRBMathUD60x18Typed.mul(

            PRBMath.UD60x18({
                value: uint256(traderMargin)
            }),

            PRBMath.UD60x18({
                value: LIQUIDATOR_REWARD
            })
        ).value;

        updatedMargin = PRBMathSD59x18Typed.sub(

            PRBMath.SD59x18({
                value: traderMargin
            }),

            PRBMath.SD59x18({
                value: int256(liquidatorReward)
            })
        ).value;
    }

    
    /// @inheritdoc IMarginEngine
    function setAMM(address _ammAddress) external onlyAMM override {
        amm = IAMM(_ammAddress);
    }

    /// @inheritdoc IMarginEngine
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external onlyAMM override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        require(params.owner == msg.sender, "only the position owner can update the position margin");

        require(marginDelta!=0, "delta cannot be zero");

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        int256 updatedMarginWouldBe = PRBMathSD59x18Typed.add(
            PRBMath.SD59x18({value: position.margin}),
            PRBMath.SD59x18({value: marginDelta})
        ).value;
        
        uint256 variableFactor = amm.rateOracle().variableFactor(false, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp());
        
        // make sure 0,0 is fixed
        checkPositionMarginCanBeUpdated(params, updatedMarginWouldBe, position.isBurned, position._liquidity, 0, 0, variableFactor); 

        position.updateMargin(marginDelta);

        if (marginDelta > 0) {
            IERC20Minimal(amm.underlyingToken()).transferFrom(params.owner, address(amm), uint256(marginDelta));
        } else {
            IERC20Minimal(amm.underlyingToken()).transferFrom(address(amm), params.owner, uint256(-marginDelta));
        }

    }
    
    /// @inheritdoc IMarginEngine
    function updateTraderMargin(address recipient, int256 marginDelta) external onlyAMM override {

        require(marginDelta!=0, "delta cannot be zero");
        require(recipient == msg.sender, "only the trader can update the margin");
        
        Trader.Info storage trader = traders.get(recipient);

        int256 updatedMarginWouldBe = PRBMathSD59x18Typed.add(
            PRBMath.SD59x18({value: trader.margin}),
            PRBMath.SD59x18({value: marginDelta})
        ).value;
        
        checkTraderMarginCanBeUpdated(updatedMarginWouldBe, trader.fixedTokenBalance, trader.variableTokenBalance, trader.isSettled);

        trader.updateMargin(marginDelta);

        if (marginDelta > 0) {
            IERC20Minimal(amm.underlyingToken()).transferFrom(recipient, address(amm), uint256(marginDelta));
        } else {
            IERC20Minimal(amm.underlyingToken()).transferFrom(address(amm), recipient, uint256(-marginDelta));
        }

    }
    
    /// @inheritdoc IMarginEngine
    function settlePosition(ModifyPositionParams memory params) external override onlyAMM {

        require(Time.blockTimestampScaled() >= amm.termEndTimestamp(), "Position cannot be settled before maturity");
        Tick.checkTicks(params.tickLower, params.tickUpper);

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper); 

        // todo: can directly call vamm from margin engine
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(params, amm.getSlot0().tick);
        
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);

        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, amm.termStartTimestamp(), amm.termEndTimestamp(), amm.rateOracle().variableFactor(true, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()));

        position.updateBalances(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMargin(settlementCashflow);

    }
    
    /// @inheritdoc IMarginEngine
    function settleTrader(address recipient) external override onlyAMM {

        require(Time.blockTimestampScaled() >= amm.termEndTimestamp(), "A Trader cannot settle before maturity");
        Trader.Info storage trader = traders.get(recipient);        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, amm.termStartTimestamp(), amm.termEndTimestamp(), amm.rateOracle().variableFactor(true, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()));

        trader.updateBalances(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMargin(settlementCashflow);
    }
    
    /// @inheritdoc IMarginEngine
    function liquidatePosition(ModifyPositionParams memory params) external override {

        require(Time.blockTimestampScaled() < amm.termEndTimestamp(), "A position cannot be liquidted after maturity");
        Tick.checkTicks(params.tickLower, params.tickUpper);
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        // todo: code duplication
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = amm.vamm().computePositionFixedAndVariableGrowthInside(params, amm.getSlot0().tick);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);

        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        bool isLiquidatable = amm.calculator().isLiquidatablePosition(
            IMarginCalculator.PositionMarginRequirementParams({
                owner: params.owner,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                isLM: true,
                currentTick: amm.getSlot0().tick,
                termStartTimestamp: amm.termStartTimestamp(),
                termEndTimestamp: amm.termEndTimestamp(),
                liquidity: position._liquidity,
                fixedTokenBalance: position.fixedTokenBalance,
                variableTokenBalance: position.variableTokenBalance,
                variableFactor: amm.rateOracle().variableFactor(false, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()),
                rateOracleId: amm.rateOracleId(),
                twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
            }),
            position.margin
        );

        require(isLiquidatable, "The position needs to be below the liquidation threshold to be liquidated");

        uint256 liquidatorReward = PRBMathUD60x18Typed.mul(

            PRBMath.UD60x18({
                value: uint256(position.margin)
            }),

            PRBMath.UD60x18({
                value: LIQUIDATOR_REWARD // todo: code a more sophisticated incentives engine for liquidators
            })

        ).value;

        position.updateMargin(-int256(liquidatorReward));

        amm.burn(params.tickLower, params.tickUpper, position._liquidity); // burn all liquidity

        IERC20Minimal(amm.underlyingToken()).transferFrom(address(amm ), msg.sender, liquidatorReward);
        
    }

    /// @inheritdoc IMarginEngine
    function liquidateTrader(address traderAddress) external override {
        
        Trader.Info storage trader = traders.get(traderAddress);
            
        bool isLiquidatable = amm.calculator().isLiquidatableTrader(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp: amm.termStartTimestamp(),
                termEndTimestamp: amm.termEndTimestamp(),
                isLM: true,
                rateOracleId: amm.rateOracleId(),
                twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
            }),
            trader.margin
        );

        require(isLiquidatable, "The trader needs to be below the liquidation threshold to be liquidated");

        (uint256 liquidatorReward, int256 updatedMargin) = calculateLiquidatorRewardAndUpdatedMargin(trader.margin);

        trader.updateMargin(updatedMargin);

        int256 notional = trader.variableTokenBalance > 0 ? trader.variableTokenBalance : -trader.variableTokenBalance;
        
        UnwindTraderUnwindPosition.unwindTrader(address(amm), traderAddress, notional);

        IERC20Minimal(amm.underlyingToken()).transferFrom(address(amm), msg.sender, liquidatorReward);

    }

    /// @inheritdoc IMarginEngine
    function checkPositionMarginRequirementSatisfied(
            address recipient,
            int24 tickLower,
            int24 tickUpper,
            uint128 amount
        ) external override {
        
        Position.Info memory position = positions.get(recipient, tickLower, tickUpper);
    
        // todo: make sure the math is safe
        uint128 amountTotal = amount + position._liquidity;
        
        // todo: check why amount is not used
        int256 marginRequirement = int256(amm.calculator().getPositionMarginRequirement(
            IMarginCalculator.PositionMarginRequirementParams({
                owner: recipient,
                tickLower: tickLower,
                tickUpper: tickUpper,
                isLM: false,
                currentTick: amm.getSlot0().tick,
                termStartTimestamp: amm.termStartTimestamp(),
                termEndTimestamp: amm.termEndTimestamp(),
                liquidity: amountTotal,
                fixedTokenBalance: 0, // todo: check not applicable for the implementation of getPositionMarginRequirement
                variableTokenBalance: 0, // todo: check not applicable for the implementation of getPositionMarginRequirement
                variableFactor: amm.rateOracle().variableFactor(false, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()),
                rateOracleId: amm.rateOracleId(),
                twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
            })
        ));

        require(position.margin >= marginRequirement, "position margin higher than requirement");

    }

    /// @inheritdoc IMarginEngine
    function updatePosition(IVAMM.ModifyPositionParams memory params, IVAMM.UpdatePositionVars memory vars) external override {
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);
        // todo: the below logic needs to be optimised
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

        int256 marginRequirement = int256(amm.calculator().getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:amm.termStartTimestamp(),
                termEndTimestamp:amm.termEndTimestamp(),
                isLM: false,
                rateOracleId: amm.rateOracleId(),
                twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
            })
        ));

        // todo: revert if margin requirement is satisfied unless it is a liquidation
        require(trader.margin >= marginRequirement, "Margin Requirement");

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