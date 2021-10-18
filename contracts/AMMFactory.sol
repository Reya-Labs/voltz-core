// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IAMMFactory.sol";
import "./AMMDeployer.sol";
import "./AMM.sol";
import "./utils/NoDelegateCall.sol";


/// @title Canonical Voltz factory
/// @notice Deploys Voltz AMMs and manages ownership and control over pool protocol fees
contract UniswapV3Factory is IAMMFactory, AMMDeployer, NoDelegateCall {
    /// @inheritdoc IAMMFactory
    address public override owner;

    /// @inheritdoc IAMMFactory
    mapping(uint24 => int24) public override feeAmountTickSpacing;
    /// @inheritdoc IAMMFactory
    mapping(address => mapping(uint256 => mapping(uint256 => uint24))) public override getPool;
    // [underlyingPool][termInDays][termStartTimestamp][fee]

    constructor() {
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);

        feeAmountTickSpacing[500] = 10; // todo: why different fee amounts for each tick spacing?
        emit FeeAmountEnabled(500, 10);
        feeAmountTickSpacing[3000] = 60;
        emit FeeAmountEnabled(3000, 60);
        feeAmountTickSpacing[10000] = 200;
        emit FeeAmountEnabled(10000, 200);
    }

    /// @inheritdoc IAMMFactory
    function createPool(
        address underlyingPool,
        uint256 termInDays,
        uint32 termStartTimestamp,
        uint24 fee
    ) external override noDelegateCall returns (address amm) {
        require(underlyingPool != address(0)); // todo: why do we need this check?
        int24 tickSpacing = feeAmountTickSpacing[fee];
        require(tickSpacing != 0);
        require(getAMM[underlyingPool][termInDays][termStartTimestamp][fee] == address(0));
        amm = deploy(address(this), underlyingPool, termInDays, termStartTimestamp, fee, tickSpacing);
        getAMM[underlyingPool][termInDays][termStartTimestamp][fee] = pool;
        emit AMMCreated(underlyingPool, termInDays, termStartTimestamp, fee, tickSpacing, pool);
    }

    /// @inheritdoc IAMMFactory
    function setOwner(address _owner) external override {
        require(msg.sender == owner);
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    /// @inheritdoc IAMMFactory
    function enableFeeAmount(uint24 fee, int24 tickSpacing) public override {
        require(msg.sender == owner);
        require(fee < 1000000); // todo: where does this amount come from?
        // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that
        // TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick
        // 16384 ticks represents a >5x price change with ticks of 1 bips
        require(tickSpacing > 0 && tickSpacing < 16384);
        require(feeAmountTickSpacing[fee] == 0);

        feeAmountTickSpacing[fee] = tickSpacing;
        emit FeeAmountEnabled(fee, tickSpacing);
    }
}