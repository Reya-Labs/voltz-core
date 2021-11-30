// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./interfaces/IAMMFactory.sol";
import "./interfaces/IAMMFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./AMMDeployer.sol";
import "./AMM.sol";
import "./utils/NoDelegateCall.sol";
import "./core_libraries/FixedAndVariableMath.sol";

// todo: introduce VoltzData.sol that is above the AMMFactory?
/// @title Canonical Voltz factory
/// @notice Deploys Voltz AMMs and manages ownership and control over amm protocol fees
contract AMMFactory is IAMMFactory, AMMDeployer, NoDelegateCall {
    
    mapping(bytes32 => address) public override getRateOracleAddress;
    address public override owner;
    mapping(uint24 => int24) public override feeAmountTickSpacing;
    mapping(bytes32 => mapping(address => mapping(uint256 => mapping(uint256 => mapping(uint24 => address))))) public getAMMMAp;

    address public override treasury;

    address public override insuranceFund;

    constructor(address _treasury, address _insuranceFund) {

        require(_treasury != address(0), "ZERO_ADDRESS");
        require(_insuranceFund != address(0), "ZERO_ADDRESS");
        treasury = _treasury;
        insuranceFund = _insuranceFund;

        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);

        feeAmountTickSpacing[500] = 10; // todo: why different fee amounts for each tick spacing?
        emit FeeAmountEnabled(500, 10);
        feeAmountTickSpacing[3000] = 60;
        emit FeeAmountEnabled(3000, 60);
        feeAmountTickSpacing[10000] = 200;
        emit FeeAmountEnabled(10000, 200);
    }

    function setTreasury(address _treasury) external override {
        require(_treasury != address(0), "ZERO_ADDRESS");

        treasury = _treasury;

        // emit treasury set
    }

    function setInsuranceFund(address _insuranceFund) external override {
        require(_insuranceFund != address(0), "ZERO_ADDRESS");

        insuranceFund = _insuranceFund;

        // emit insurance fund set
    }

    function createAMM(
        address underlyingToken,
        bytes32 rateOracleId,
        uint256 termEndTimestamp,
        uint24 fee
    ) external override noDelegateCall returns (address amm) {
        int24 tickSpacing = feeAmountTickSpacing[fee]; 
        require(tickSpacing != 0);
        
        uint256 termStartTimestamp = FixedAndVariableMath.blockTimestampScaled();

        require(
            getAMMMAp[rateOracleId][underlyingToken][termStartTimestamp][termEndTimestamp][fee] ==
                address(0)
        );

        amm = deploy(
            address(this),
            underlyingToken,
            rateOracleId,
            termStartTimestamp,
            termEndTimestamp,
            fee,
            tickSpacing
        );

        getAMMMAp[rateOracleId][underlyingToken][termStartTimestamp][termEndTimestamp][fee] = amm;
        emit AMMCreated(
            rateOracleId,
            underlyingToken,
            termEndTimestamp,
            termStartTimestamp,
            fee,
            tickSpacing,
            amm
        );
        return amm;
    }

    function setOwner(address _owner) external override {
        require(msg.sender == owner);
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }


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

    // todo initialised, onlyGovernance
    function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress) external override {
        
        require(_rateOracleId != bytes32(0), "ZERO_BYTES");
        require(_rateOracleAddress != address(0), "ZERO_ADDRESS");
        require(_rateOracleId == IRateOracle(_rateOracleAddress).rateOracleId(), "INVALID_ID");
        require(getRateOracleAddress[_rateOracleId] == address(0), "EXISTED_ID");

        getRateOracleAddress[_rateOracleId] = _rateOracleAddress;

        // todo: emit RateOracleAdded
    }
}
