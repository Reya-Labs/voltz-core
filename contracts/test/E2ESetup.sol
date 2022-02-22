// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "contracts/test/TestMarginEngine.sol";
import "contracts/test/TestVAMM.sol";
import "contracts/utils/Printer.sol";

contract Actor {
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

    function swap(address VAMMAddress, IVAMM.SwapParams memory params)
        external
    {
        IVAMM(VAMMAddress).swap(params);
    }
}

contract E2ESetup {
    struct UniqueIdentifiersPosition {
        address owner;
        int24 tickLower;
        int24 tickUpper;
    }

    struct PositionSnapshot {
        uint256 currentTimestampWad;
        uint256 termStartTimestampWad;
        uint256 termEndTimestampWad;
        int256 margin;
        uint256 marginRequirement;
        int256 estimatedSettlementCashflow;
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
    }

    function abs(int256 value) public pure returns (uint256) {
        if (value < 0) return uint256(-value);
        else return uint256(value);
    }

    mapping(uint256 => UniqueIdentifiersPosition) public allPositions;
    mapping(bytes32 => uint256) public indexAllPositions;
    uint256 public sizeAllPositions = 0;

    mapping(bytes32 => mapping(uint256 => PositionSnapshot))
        public positionHistory;
    mapping(bytes32 => uint256) public sizeOfPositionHistory;

    int256 public initialCashflow = 0;

    uint256 public keepInMindGas;

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

        uint256 gasBefore = gasleft();
        Actor(recipient).mint(
            VAMMAddress,
            recipient,
            tickLower,
            tickUpper,
            amount
        );
        keepInMindGas = gasBefore - gasleft();

        continuousInvariants();
    }

    function burn(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) public {
        this.addPosition(recipient, tickLower, tickUpper);

        uint256 gasBefore = gasleft();
        Actor(recipient).burn(
            VAMMAddress,
            recipient,
            tickLower,
            tickUpper,
            amount
        );
        keepInMindGas = gasBefore - gasleft();

        continuousInvariants();
    }

    function swap(IVAMM.SwapParams memory params) public {
        this.addPosition(params.recipient, params.tickLower, params.tickUpper);

        uint256 gasBefore = gasleft();
        Actor(params.recipient).swap(VAMMAddress, params);
        keepInMindGas = gasBefore - gasleft();

        continuousInvariants();
    }

    function computeEstimatedVariableFactorAtMaturity()
        internal
        returns (uint256 estimatedVariableFactorFromStartToMaturity)
    {
        uint256 historicalAPYWad = IMarginEngine(MEAddress).getHistoricalApy();

        uint256 termStartTimestampWad = IMarginEngine(MEAddress)
            .termStartTimestampWad();
        uint256 termEndTimestampWad = IMarginEngine(MEAddress)
            .termEndimestampWad();

        uint256 termInYears = FixedAndVariableMath.accrualFact(
            termEndTimestampWad - termStartTimestampWad
        );

        // calculate the estimated variable factor from start to maturity
        estimatedVariableFactorFromStartToMaturity =
            PRBMathUD60x18.pow(
                (PRBMathUD60x18.fromUint(1) + historicalAPYWad),
                termInYears
            ) -
            PRBMathUD60x18.fromUint(1);
    }

    function updatePositionMargin(
        address _owner,
        int24 tickLower,
        int24 tickUpper,
        int256 marginDelta
    ) public {
        this.addPosition(_owner, tickLower, tickUpper);

        uint256 gasBefore = gasleft();
        IMarginEngine(MEAddress).updatePositionMargin(
            _owner,
            tickLower,
            tickUpper,
            marginDelta
        );
        keepInMindGas = gasBefore - gasleft();
        initialCashflow += marginDelta;

        continuousInvariants();
    }

    function continuousInvariants() public {
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

        int256 liquidatablePositions = 0;
        for (uint256 i = 1; i <= sizeAllPositions; i++) {
            TestMarginEngine(MEAddress)
                .updatePositionTokenBalancesAndAccountForFeesTest(
                    allPositions[i].owner,
                    allPositions[i].tickLower,
                    allPositions[i].tickUpper,
                    false
                );

            Position.Info memory position = IMarginEngine(MEAddress)
                .getPosition(
                    allPositions[i].owner,
                    allPositions[i].tickLower,
                    allPositions[i].tickUpper
                );

            Printer.printInt256(
                "   fixedTokenBalance:",
                position.fixedTokenBalance
            );
            Printer.printInt256(
                "variableTokenBalance:",
                position.variableTokenBalance
            );
            Printer.printInt256("              margin:", position.margin);

            int256 estimatedSettlementCashflow = FixedAndVariableMath
                .calculateSettlementCashflow(
                    position.fixedTokenBalance,
                    position.variableTokenBalance,
                    termStartTimestampWad,
                    termEndTimestampWad,
                    estimatedVariableFactorFromStartToMaturity()
                );

            TestMarginEngine(MEAddress).getPositionMarginRequirementTest(
                allPositions[i].owner,
                allPositions[i].tickLower,
                allPositions[i].tickUpper,
                true
            );
            uint256 marginRequirement = TestMarginEngine(MEAddress).getMargin();

            if (int256(marginRequirement) > position.margin) {
                liquidatablePositions += 1;
            }

            bytes32 hashedPositon = keccak256(
                abi.encodePacked(
                    allPositions[i].owner,
                    allPositions[i].tickLower,
                    allPositions[i].tickUpper
                )
            );

            PositionSnapshot memory positionSnapshot;

            positionSnapshot.margin = position.margin;
            positionSnapshot.marginRequirement = marginRequirement;

            positionSnapshot.termStartTimestampWad = termStartTimestampWad;
            positionSnapshot.termEndTimestampWad = termEndTimestampWad;
            positionSnapshot.currentTimestampWad = Time.blockTimestampScaled();

            positionSnapshot
                .estimatedSettlementCashflow = estimatedSettlementCashflow;

            positionSnapshot.fixedTokenBalance = position.fixedTokenBalance;
            positionSnapshot.variableTokenBalance = position
                .variableTokenBalance;

            sizeOfPositionHistory[hashedPositon] += 1;
            positionHistory[hashedPositon][
                sizeOfPositionHistory[hashedPositon]
            ] = positionSnapshot;

            totalFixedTokens += position.fixedTokenBalance;
            totalVariableTokens += position.variableTokenBalance;
            totalCashflow += position.margin;
            totalCashflow += estimatedSettlementCashflow;
        }

        totalCashflow += int256(IVAMM(VAMMAddress).protocolFees());

        Printer.printInt256("   totalFixedTokens:", totalFixedTokens);
        Printer.printInt256("totalVariableTokens:", totalVariableTokens);
        Printer.printInt256(
            "      deltaCashflow:",
            totalCashflow - initialCashflow
        );
        Printer.printInt256("liquidatable Positions", liquidatablePositions);
        Printer.printEmptyLine();

        // ideally, this should be 0
        int256 approximation = 100000;

        Printer.printUint256("      app:", uint256(approximation));

        require(
            abs(totalFixedTokens) < uint256(approximation),
            "fixed tokens don't net out"
        );
        require(
            abs(totalVariableTokens) < uint256(approximation),
            "variable tokens don't net out"
        );
        /// @audit the following should hold
        // require(
        //     initialCashflow <= totalCashflow,
        //     "system loss: undercollateralized"
        // );
        require(
            abs(totalCashflow - initialCashflow) < uint256(approximation),
            "cashflows don't net out"
        );
    }

    function getPositionHistory(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public view returns (PositionSnapshot[] memory) {
        bytes32 hashedPositon = keccak256(
            abi.encodePacked(owner, tickLower, tickUpper)
        );
        uint256 len = sizeOfPositionHistory[hashedPositon];
        PositionSnapshot[] memory snapshots = new PositionSnapshot[](len);

        for (uint256 i = 0; i < len; i++) {
            snapshots[i] = positionHistory[hashedPositon][i + 1];
        }

        return snapshots;
    }

    function getGasConsumedAtLastTx() external view returns (uint256) {
        return keepInMindGas;
    }
}
