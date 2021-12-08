// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "./utils/NoDelegateCall.sol";
import "./core_libraries/Tick.sol";
import "./interfaces/IDeployer.sol";
import "./interfaces/IAMM.sol";
import "./core_libraries/TickBitmap.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";

import "./utils/SafeCast.sol";
import "./utils/LowGasSafeMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./core_libraries/SwapMath.sol";

import "hardhat/console.sol";
import "./interfaces/IMarginCalculator.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./core_libraries/FixedAndVariableMath.sol";

import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";

// todo: factoryOwner is the treasury, don't need a separate treasury address


// todo: only the amm can interact with the vAMM and the MarginEngine, hence if you make the AMM pausable, you are essentially pausing the vAMM and the MarginEngine
contract AMM is IAMM, Pausable {
    
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    using Trader for mapping(bytes32 => Trader.Info);
    using Trader for Trader.Info;

    using Tick for mapping(int24 => Tick.Info);
    using TickBitmap for mapping(int16 => uint256);

    address public immutable override factory;

    address public immutable override underlyingToken;

    bytes32 public immutable override rateOracleId;

    uint256 public immutable override termStartTimestamp;

    uint256 public immutable override termEndTimestamp;

    IMarginCalculator public override calculator;
    
    IRateOracle public override rateOracle;

    mapping(bytes32 => Position.Info) public override positions;
    mapping(bytes32 => Trader.Info) public override traders;

    IVAMM public override vamm;  
    IMarginEngine public override marginEngine;
    bool public override unlocked;

    mapping(int24 => Tick.Info) public override ticks;
    mapping(int16 => uint256) public override tickBitmap;

    
    constructor() Pausable() {
        (
            factory,
            underlyingToken,
            rateOracleId,
            termStartTimestamp,
            termEndTimestamp
        ) = IDeployer(msg.sender).ammParameters();
        
        address rateOracleAddress = IFactory(factory).getRateOracleAddress(rateOracleId);

        rateOracle = IRateOracle(rateOracleAddress);

        address calculatorAddress = IFactory(factory).calculator();
        
        calculator = IMarginCalculator(calculatorAddress);
    }
    
    modifier onlyFactoryOwner() {
        require(IFactory(factory).owner() != address(0));
        require(msg.sender == IFactory(factory).owner());
        _;
    }

    modifier onlyVAMM() {
        require(address(vamm) != address(0));
        require(msg.sender == address(vamm));
        _;
    }

    // todo: make sure locks are correctly placed
    /// @dev Mutually exclusive reentrancy protection into the vamm to/from a method. This method also prevents entrance
    /// to a function before the pool is initialized. The reentrancy guard is required throughout the contract because
    /// we use balance checks to determine the payment status of interactions such as mint, swap and flash.
    modifier lock() {
        require(unlocked, "LOK");
        unlocked = false;
        _;
        unlocked = true;
    }

    function getSlot0() external view override {
        return vamm.slot0();
    }

    function getVariableTokenGrowthGlobal() external view override {
        return vamm.variableTokenGrowthGlobal();
    }

    function getFixedTokenGrowthGlobal() external view override {
        return vamm.fixedTokenGrowthGlobal();
    }

    function getFixedTokenGrowthInside(Tick.FixedTokenGrowthInsideParams memory params) external view override {
        return ticks.getFixedTokenGrowthInside(params);
    }

    function getVariableTokenGrowthInside(Tick.VariableTokenGrowthInsideParams memory params) external view override {
        return ticks.getVariableTokenGrowthInside(params);
    }

    function getFeeGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        uint256 feeGrowthGlobal
    ) external view override {
        return ticks.getFeeGrowthInside(tickLower, tickUpper, tickCurrent, feeGrowthGlobal);
    }
    
    function setVAMM(address _vAMMAddress) external onlyFactoryOwner override {
        vamm = IVAMM(_vAMMAddress);
    }

    function setMarginEngine(address _marginEngine) external onlyFactoryOwner override {
        marginEngine = IMarginEngine(_marginEngine);
    }

    function setUnlocked(bool _unlocked) external onlyVAMM override {
        unlocked = _unlocked;
    }

    function updatePositionMargin(IMarginEngine.ModifyPositionParams memory params, int256 marginDelta) external override {
        marginEngine.updatePositionMargin(params, marginDelta);
    }

    function updateTraderMargin(address recipient, int256 marginDelta) external override {
        marginEngine.updateTraderMargin(recipient, marginDelta);
    }
    
    function settlePosition(IMarginEngine.ModifyPositionParams memory params) external override {
        marginEngine.settlePosition(params);
    }
    
    function settleTrader(address recipient) external override  {
        marginEngine.settleTrader(recipient);
    }
    
    function liquidatePosition(IMarginEngine.ModifyPositionParams memory params) whenNotPaused external override {
        marginEngine.liquidatePosition(params);
    }

    function liquidateTrader(address traderAddress) whenNotPaused external override {
        marginEngine.liquidateTrader(traderAddress);
    }
    

    // todo: the lock is applied inside the vAMM
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override lock{
        vamm.burn(tickLower, tickUpper, amount);
    }
    

    // todo: locking in AMM (this makes more sense) vs. vAMM
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override whenNotPaused lock {
        vamm.mint(recipient, tickLower, tickUpper, amount); // todo: how costly are these calls?
    }


    // todo: figure out where this is necessary and comment out for now
    // // todo: split this function into smaller pieces?
    // function updateTrader(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance) external {
    //     require(recipient==msg.sender); // todo: turn into a modifier
    //     marginEngine.updateTrader(recipient, fixedTokenBalance, variableTokenBalance, additionalMargin);
    // }
    

    function swap(
        IVAMM.SwapParams memory params
    ) external override whenNotPaused lock{
        vamm.swap(params); // no need to register the returned values
    }

    function setFeeProtocol(uint256 feeProtocol) external lock override onlyFactoryOwner  {
        vamm.setFeeProtocol(feeProtocol);
    }

    function collectProtocol(
        address recipient,
        uint256 amountRequested
    ) external lock override onlyFactoryOwner returns (uint256 amount){

        // moved this logic to vamm.updateProtocolFees
        // amount = amountRequested > protocolFees ? protocolFees : amountRequested;

        if (amount > 0) {
            vamm.updateProtocolFees(amount);
            IERC20Minimal(underlyingToken).transferFrom(address(this), recipient, amount);
        }

        // todo: emit collect protocol event
    }

    // tick related logic (feels like it shouldn't be here)

    function flipTicks(IVAMM.ModifyPositionParams memory params, uint256 _feeGrowthGlobal, int24 currentTick, int256 fixedTokenGrowthGlobal, int256 variableTokenGrowthGlobal,  uint128 maxLiquidityPerTick, int24 tickSpacing) external override returns(bool flippedLower, bool flippedUpper) {
        
        flippedLower = ticks.update(
            params.tickLower,
            currentTick,
            params.liquidityDelta,
            fixedTokenGrowthGlobal,
            variableTokenGrowthGlobal,
            _feeGrowthGlobal,
            false,
            maxLiquidityPerTick
        );
        flippedUpper = ticks.update(
            params.tickUpper,
            currentTick,
            params.liquidityDelta,
            fixedTokenGrowthGlobal,
            variableTokenGrowthGlobal,
            _feeGrowthGlobal,
            true,
            maxLiquidityPerTick
        );

        if (flippedLower) {
            tickBitmap.flipTick(params.tickLower, tickSpacing);
        }
        if (flippedUpper) {
            tickBitmap.flipTick(params.tickUpper, tickSpacing);
        }

    }

    function clearTicks(int24 tick) external override{
        ticks.clear(tick);
    }

    function crossTicks(
        int24 tick,
        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal,
        uint256 feeGrowthGlobal
    ) external override {
        ticks.cross(tick, fixedTokenGrowthGlobal, variableTokenGrowthGlobal, feeGrowthGlobal);
    }


}