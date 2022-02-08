// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "contracts/test/TestMarginEngine.sol";
import "contracts/test/TestVAMM.sol";
import "contracts/utils/Printer.sol";

contract Swapper {
    function swap(address VAMMAddress, IVAMM.SwapParams memory params) external {
        IVAMM(VAMMAddress).swap(params);
    }
}

contract Minter {
    function mint(
        address VAMMAddress,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IVAMM(VAMMAddress).mint(recipient, tickLower, tickUpper, amount);
    }

    function burn(
        address VAMMAddress,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IVAMM(VAMMAddress).burn(recipient, tickLower, tickUpper, amount);
    }
}

contract E2ESetup {
    struct UniqueIdentifiersPosition {
        address owner;
        int24 tickLower;
        int24 tickUpper;
    }

    function abs(int256 value) public pure returns (uint256) {
        if (value < 0) return uint256(-value);
        else return uint256(value);
    }

    mapping(uint256 => UniqueIdentifiersPosition) public allPositions;
    mapping(bytes32 => uint256) public indexAllPositions;
    uint256 public sizeAllPositions = 0;

    mapping(uint256 => address) public allTraders;
    mapping(address => uint256) public indexAllTraders;
    uint256 public sizeAllTraders = 0;

    int256 initialCashflow = 0;

    function addTrader(address trader) public {
        if (indexAllTraders[trader] > 0) {
            return;
        }
        sizeAllTraders += 1;
        allTraders[sizeAllTraders] = trader;
        indexAllTraders[trader] = sizeAllTraders;
    }

    function addPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public {
        bytes32 hashedPositon = keccak256(
            abi.encodePacked(owner, tickLower, tickUpper)
        );
        if (indexAllPositions[hashedPositon] > 0) {
            return;
        }
        sizeAllPositions += 1;
        allPositions[sizeAllPositions] = UniqueIdentifiersPosition(
            owner,
            tickLower,
            tickUpper
        );
        indexAllPositions[hashedPositon] = sizeAllPositions;
    }

    address public MEAddress;
    address public VAMMAddress;
    address public rateOracleAddress;

    function setMEAddress(address _MEAddress) public {
        MEAddress = _MEAddress;
    }

    function setVAMMAddress(address _VAMMAddress) public {
        VAMMAddress = _VAMMAddress;
    }

    function setRateOracleAddress(address _rateOracleAddress) public {
        rateOracleAddress = _rateOracleAddress;
    }

    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) public {
        this.addPosition(recipient, tickLower, tickUpper);
        Minter(recipient).mint(VAMMAddress, recipient, tickLower, tickUpper, amount);
        
        if (!continuousInvariants()) {
            revert("Invariants do not hold");
        }
    }

    function burn(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) public {
        this.addPosition(recipient, tickLower, tickUpper);
        Minter(recipient).burn(VAMMAddress, recipient, tickLower, tickUpper, amount);
        
        if (!continuousInvariants()) {
            revert("Invariants do not hold");
        }
    }

    function swap(IVAMM.SwapParams memory params) public {
        if (params.isTrader) {
            this.addTrader(params.recipient);
        } else {
            this.addPosition(
                params.recipient,
                params.tickLower,
                params.tickUpper
            );
        }
        Swapper(params.recipient).swap(VAMMAddress, params);
        
        if (!continuousInvariants()) {
            revert("Invariants do not hold");
        }
    }

    function updatePositionMargin(
        IPositionStructs.ModifyPositionParams memory params,
        int256 marginDelta
    ) public {
        this.addPosition(params.owner, params.tickLower, params.tickUpper);
        IMarginEngine(MEAddress).updatePositionMargin(params, marginDelta);
        initialCashflow += marginDelta;
        
        if (!continuousInvariants()) {
            revert("Invariants do not hold");
        }
    }

    function updateTraderMargin(address trader, int256 marginDelta) public {
        this.addTrader(trader);
        IMarginEngine(MEAddress).updateTraderMargin(trader, marginDelta);
        initialCashflow += marginDelta;

        if (!continuousInvariants()) {
            revert("Invariants do not hold");
        }
    }

    function continuousInvariants() public returns (bool) {
        int256 totalFixedTokens = 0;
        int256 totalVariableTokens = 0;
        int256 totalCashflow = 0;

        uint256 termStartTimestampWad = uint256(
            IMarginEngine(MEAddress).termStartTimestampWad()
        );
        uint256 termEndTimestampWad = uint256(
            IMarginEngine(MEAddress).termEndTimestampWad()
        );

        uint256 variableFactor = IRateOracle(rateOracleAddress).variableFactor(
            termStartTimestampWad,
            termEndTimestampWad
        );

        for (uint256 i = 1; i <= sizeAllPositions; i++) {
            TestMarginEngine(MEAddress)
                .updatePositionTokenBalancesAndAccountForFeesTest(
                    allPositions[i].owner,
                    allPositions[i].tickLower,
                    allPositions[i].tickUpper
                );
            Position.Info memory position = IMarginEngine(MEAddress)
                .getPosition(
                    allPositions[i].owner,
                    allPositions[i].tickLower,
                    allPositions[i].tickUpper
                );
            totalFixedTokens += position.fixedTokenBalance;
            totalVariableTokens += position.variableTokenBalance;
            totalCashflow += position.margin;
            totalCashflow += FixedAndVariableMath.calculateSettlementCashflow(
                position.fixedTokenBalance,
                position.variableTokenBalance,
                termStartTimestampWad,
                termEndTimestampWad,
                variableFactor
            );
        }

        for (uint256 i = 1; i <= sizeAllTraders; i++) {
            (
                int256 margin,
                int256 fixedTokenBalance,
                int256 variableTokenBalance,

            ) = IMarginEngine(MEAddress).traders(allTraders[i]);
            totalFixedTokens += fixedTokenBalance;
            totalVariableTokens += variableTokenBalance;
            totalCashflow += margin;
            totalCashflow += FixedAndVariableMath.calculateSettlementCashflow(
                fixedTokenBalance,
                variableTokenBalance,
                termStartTimestampWad,
                termEndTimestampWad,
                variableFactor
            );
        }

        Printer.printInt256("   totalFixedTokens:", totalFixedTokens);
        Printer.printInt256("totalVariableTokens:", totalVariableTokens);
        Printer.printInt256("    initialCashflow:", initialCashflow);
        Printer.printInt256("      totalCashflow:", totalCashflow);
        Printer.printEmptyLine();

        // ideally, this should be 0
        uint256 approximation = 100;
        if (abs(totalFixedTokens) > approximation) {
            return false;
        }

        if (abs(totalVariableTokens) > approximation) {
            return false;
        }

        if (abs(totalCashflow - initialCashflow) > approximation) {
            return false;
        }

        return true;
    }
}
