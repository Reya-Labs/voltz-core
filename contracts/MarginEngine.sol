// SPDX-License-Identifier: BUSL-1.1

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


// todo: factoryOwner is the treasury, don't need a separate treasury address

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

    uint256 public constant LIQUIDATOR_REWARD = 2 * 10**15; // 0.2%=0.002 of the total margin (or remaining?)
    IAMM public override amm;

    constructor() {  
        address ammAddress;      
        (ammAddress) = IDeployer(msg.sender).marginEngineParameters();
        amm = IAMM(ammAddress);
    }

    modifier onlyAMM () {
        require(msg.sender == amm.address);
        _;
    }    

    function setAMM(address _ammAddress) external onlyAMM override {
        amm = IAMM(_ammAddress);
    }
    
    function checkPositionMarginAboveRequirement(ModifyPositionParams memory params, int256 updatedMarginWouldBe) internal view {
            
        IMarginCalculator.PositionMarginRequirementParams memory marginReqParams = IMarginCalculator.PositionMarginRequirementParams(
            {
                owner: params.owner,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                isLM: false,
                rateOracleId: amm.rateOracleId(),
                twapApy: amm.rateOracle().getTwapApy(amm.underlyingToken())
            }
        );

        int256 positionMarginRequirement = int256(amm.calculator().getPositionMarginRequirement(marginReqParams));             

        require(updatedMarginWouldBe > positionMarginRequirement, "Cannot have less margin than the minimum requirement");
    }



    function checkTraderMarginAboveRequirement(address recipient, int256 updatedMarginWouldBe, int256 fixedTokenBalance, int256 variableTokenBalance) internal view {

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
    
    function checkTraderMarginCanBeUpdated(address recipient, int256 updatedMarginWouldBe, int256 fixedTokenBalance, int256 variableTokenBalance, bool isTraderSettled) internal view {

        if (FixedAndVariableMath.blockTimestampScaled() >= amm.termEndTimestamp()) {
            require(isTraderSettled);

            require(updatedMarginWouldBe>=0, "can't withdraw more than have");

        } else {

            checkTraderMarginAboveRequirement(recipient, updatedMarginWouldBe, fixedTokenBalance, variableTokenBalance);
        }

    }
    
    // todo: don't let position settlements be done separately from burning?
    // todo: can be a modifier
    function checkPositionMarginCanBeUpdated(ModifyPositionParams memory params, int256 updatedMarginWouldBe, bool isPositionBurned) internal view {

        if (FixedAndVariableMath.blockTimestampScaled() >= amm.termEndTimestamp()) {
            // todo: check if the position is settled 
            require(isPositionBurned);
            require(updatedMarginWouldBe>=0, "can't withdraw more than have");
        } else {
            checkPositionMarginAboveRequirement(params, updatedMarginWouldBe);
        }

    }
    
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external onlyAMM override {

        Tick.checkTicks(params.tickLower, params.tickUpper);

        require(params.owner == msg.sender, "only the position owner can update the position margin");

        require(marginDelta!=0, "delta cannot be zero");

        Position.Info storage position = amm.positions().get(params.owner, params.tickLower, params.tickUpper);  

        int256 updatedMarginWouldBe = PRBMathSD59x18Typed.add(
            PRBMath.SD59x18({value: position.margin}),
            PRBMath.SD59x18({value: marginDelta})
        ).value;
        
        checkPositionMarginCanBeUpdated(params, updatedMarginWouldBe, position.isBurned); 

        position.updateMargin(marginDelta);

        if (marginDelta > 0) {
            IERC20Minimal(amm.underlyingToken()).transferFrom(params.owner, amm.address, uint256(marginDelta));
        } else {
            IERC20Minimal(amm.underlyingToken()).transferFrom(amm.address, params.owner, uint256(-marginDelta));
        }

    }
    
    
    function updateTraderMargin(address recipient, int256 marginDelta) external onlyAMM override {

        require(marginDelta!=0, "delta cannot be zero");
        require(recipient == msg.sender, "only the trader can update the margin");
        
        Trader.Info storage trader = amm.traders().get(recipient);

        int256 updatedMarginWouldBe = PRBMathSD59x18Typed.add(
            PRBMath.SD59x18({value: trader.margin}),
            PRBMath.SD59x18({value: marginDelta})
        ).value;
        
        checkTraderMarginCanBeUpdated(recipient, updatedMarginWouldBe, trader.isSettled);

        trader.updateMargin(marginDelta);

        if (marginDelta > 0) {
            IERC20Minimal(amm.underlyingToken()).transferFrom(recipient, amm.address, uint256(marginDelta));
        } else {
            IERC20Minimal(amm.underlyingToken()).transferFrom(amm.address, recipient, uint256(-marginDelta));
        }

    }

    // todo: can be a library    
    function computePositionFixedAndVariableGrowthInside(ModifyPositionParams memory params, int24 currentTick)
     internal view returns(int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) {

        fixedTokenGrowthInside = amm.ticks.getFixedTokenGrowthInside(
            Tick.FixedTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: currentTick,
                fixedTokenGrowthGlobal: amm.getFixedTokenGrowthGlobal()
            }) 
        ); 

        variableTokenGrowthInside = amm.ticks.getVariableTokenGrowthInside(
            Tick.VariableTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: currentTick,
                variableTokenGrowthGlobal: amm.getVariableTokenGrowthGlobal()
            })
        );

    }
    
    function settlePosition(ModifyPositionParams memory params) external override onlyAMM {

        require(FixedAndVariableMath.blockTimestampScaled() >= amm.termEndTimestamp(), "Position cannot be settled before maturity");
        Tick.checkTicks(params.tickLower, params.tickUpper);

        IVAMM.Slot0 memory _slot0 = amm.getSlot0(); // SLOAD for gas optimization

        Position.Info storage position = amm.positions().get(params.owner, params.tickLower, params.tickUpper); 

        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = computePositionFixedAndVariableGrowthInside(params, amm.getSlot0().tick);
        
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);

        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, amm.termStartTimestamp(), amm.termEndTimestamp(), amm.rateOracle().variableFactor(true, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()));

        position.updateBalances(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMargin(settlementCashflow);

    }
    
    function settleTrader(address recipient) external override onlyAMM {

        require(FixedAndVariableMath.blockTimestampScaled() >= amm.termEndTimestamp(), "A Trader cannot settle before maturity");
        Trader.Info storage trader = amm.traders().get(recipient);        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, amm.termStartTimestamp(), amm.termEndTimestamp(), amm.rateOracle().variableFactor(true, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()));

        trader.updateBalances(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMargin(settlementCashflow);
    }
    
    function liquidatePosition(ModifyPositionParams memory params) external override {

        require(FixedAndVariableMath.blockTimestampScaled() < amm.termEndTimestamp(), "A position cannot be liquidted after maturity");
        Tick.checkTicks(params.tickLower, params.tickUpper);
        Position.Info storage position = amm.positions().get(params.owner, params.tickLower, params.tickUpper);  

        // todo: code duplication
        (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) = computePositionFixedAndVariableGrowthInside(params, amm.getSlot0().tick);
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

        IERC20Minimal(amm.underlyingToken()).transferFrom(amm.address, msg.sender, liquidatorReward);
        
    }

    // todo: can be put into a library
    function calculateLiquidatorRewardAndUpdatedMargin(int256 traderMargin) internal  returns (uint256 liquidatorReward, int256 updatedMargin) {

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
    
    function liquidateTrader(address traderAddress) external override {
        
        Trader.Info storage trader = amm.traders().get(traderAddress);
            
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
        
        UnwindTraderUnwindPosition.unwindTrader(amm.address, traderAddress, notional);

        IERC20Minimal(amm.underlyingToken()).transferFrom(amm.address, msg.sender, liquidatorReward);

    }

}