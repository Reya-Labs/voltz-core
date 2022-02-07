// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "contracts/test/TestMarginEngine.sol";

contract E2ESetup {
    struct UniqueIdentifiersPosition {
        address owner;
        int24 tickLower;
        int24 tickUpper;
    }

    mapping (uint => UniqueIdentifiersPosition) public allPositions;
    mapping (bytes32 => uint) public indexAllPositions;
    uint public sizeAllPositions = 0;

    mapping (uint => address) public allTraders;
    mapping (address => uint) public indexAllTraders;
    uint public sizeAllTraders = 0;

    int256 initialCashflow = 0;

    function addTrader(address trader) external {
        if (indexAllTraders[trader] == 0) {
            return;
        }
        sizeAllTraders += 1;
        allTraders[sizeAllTraders] = trader;
        indexAllTraders[trader] = sizeAllTraders;
    }

    function addPosition(address owner, int24 tickLower, int24 tickUpper) external {
        bytes32 hashedPositon = keccak256(abi.encodePacked(owner, tickLower, tickUpper));
        if (indexAllPositions[hashedPositon] == 0) {
            return;
        }
        sizeAllPositions += 1;
        allPositions[sizeAllPositions] = UniqueIdentifiersPosition(owner, tickLower, tickUpper);
        indexAllPositions[hashedPositon] = sizeAllPositions;
    }

    address public MEAddress;
    address public VAMMAddress;
    address public rateOracleAddress;
    
    function setMEAddress(address _MEAddress) external {
        MEAddress = _MEAddress;
    }

    function setVAMMAddress(address _VAMMAddress) external {
        VAMMAddress = _VAMMAddress;
    }

    function setRateOracleAddress(address _rateOracleAddress) external {
        rateOracleAddress = _rateOracleAddress;
    }

    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        this.addPosition(recipient, tickLower, tickUpper);
        IVAMM(VAMMAddress).mint(recipient, tickLower, tickUpper, amount);
    }

    function burn(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        this.addPosition(recipient, tickLower, tickUpper);
        IVAMM(VAMMAddress).burn(recipient, tickLower, tickUpper, amount);
    }

    function swap(IVAMM.SwapParams memory params) external {
        if (params.isTrader) {
            this.addTrader(params.recipient);
        }
        else {
            this.addPosition(params.recipient, params.tickLower, params.tickUpper);
        }
        IVAMM(VAMMAddress).swap(params);
    }

    function updatePositionMargin(IPositionStructs.ModifyPositionParams memory params, int256 marginDelta) external {
        this.addPosition(params.owner, params.tickLower, params.tickUpper);
        IMarginEngine(MEAddress).updatePositionMargin(params, marginDelta);
        initialCashflow += marginDelta;
    }

    function updateTraderMargin(address trader, int256 marginDelta) external {
        this.addTrader(trader);
        IMarginEngine(MEAddress).updateTraderMargin(trader, marginDelta);
        initialCashflow += marginDelta;
    }

    function continuousInvariants() external returns (bool) {
        int256 totalFixedTokens = 0;
        int256 totalVariableTokens = 0;
        int256 totalCashflow = 0;

        uint256 termStartTimestampWad = uint256(IMarginEngine(MEAddress).termStartTimestampWad());
        uint256 termEndTimestampWad = uint256(IMarginEngine(MEAddress).termEndTimestampWad());

        uint256 variableFactor = IRateOracle(rateOracleAddress).variableFactor(termStartTimestampWad, termEndTimestampWad);

        for (uint i = 1; i <= sizeAllPositions; i++) {
            Position.Info memory position = IMarginEngine(MEAddress).getPosition(allPositions[i].owner, allPositions[i].tickLower, allPositions[i].tickUpper);
            TestMarginEngine(MEAddress).updatePositionTokenBalancesAndAccountForFeesTest(allPositions[i].owner, allPositions[i].tickLower, allPositions[i].tickUpper);
            totalFixedTokens += position.fixedTokenBalance;
            totalVariableTokens += position.variableTokenBalance;
            totalCashflow += position.margin;
            totalCashflow += FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestampWad, termEndTimestampWad, variableFactor);
        }

        for (uint i = 1; i <= sizeAllTraders; i++) {
            (int256 margin, int256 fixedTokenBalance, int256 variableTokenBalance, ) = IMarginEngine(MEAddress).traders(allTraders[i]);
            totalFixedTokens += fixedTokenBalance;
            totalVariableTokens += variableTokenBalance;
            totalCashflow += margin;
            totalCashflow += FixedAndVariableMath.calculateSettlementCashflow(fixedTokenBalance, variableTokenBalance, termStartTimestampWad, termEndTimestampWad, variableFactor);
        }

        if (totalFixedTokens != 0) {
            return false;
        }

        if (totalVariableTokens != 0) {
            return false;
        }

        if (totalCashflow != initialCashflow) {
            return false;
        }

        return true;
    }
}