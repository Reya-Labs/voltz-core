// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "contracts/test/TestMarginEngine.sol";
import "contracts/test/TestVAMM.sol";
import "contracts/utils/Printer.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

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
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced
        )
    {
        (
            _fixedTokenDelta,
            _variableTokenDelta,
            _cumulativeFeeIncurred,
            _fixedTokenDeltaUnbalanced
        ) = IVAMM(VAMMAddress).swap(params);
    }

    function liquidatePosition(
        address MEAddress,
        int24 tickLower,
        int24 tickUpper,
        address owner
    ) external {
        IMarginEngine(MEAddress).liquidatePosition(tickLower, tickUpper, owner);
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

    struct SwapSnapshot {
        uint256 reserveNormalizedIncomeAtSwap;
        uint256 swapInitiationTimestampWad;
        uint256 termEndTimestampWad;
        uint256 notional;
        bool isFT;
        uint256 fixedRateWad;
        uint256 feePaidInUnderlyingTokens;
    }

    function abs(int256 value) public pure returns (uint256) {
        if (value < 0) return uint256(-value);
        else return uint256(value);
    }

    using WadRayMath for uint256;
    using SafeMath for uint256;

    mapping(uint256 => UniqueIdentifiersPosition) public allPositions;
    mapping(bytes32 => uint256) public indexAllPositions;
    uint256 public sizeAllPositions = 0;

    mapping(bytes32 => mapping(uint256 => PositionSnapshot))
        public positionHistory;
    mapping(bytes32 => uint256) public sizeOfPositionHistory;

    mapping(bytes32 => mapping(uint256 => SwapSnapshot))
        public positionSwapsHistory;
    mapping(bytes32 => uint256) public sizeOfPositionSwapsHistory;

    int256 public initialCashflow = 0;
    int256 public liquidationRewards = 0;

    uint256 public keepInMindGas;

    function getReserveNormalizedIncome() internal returns (uint256) {
        IRateOracle rateOracle = IMarginEngine(MEAddress).rateOracle();
        IAaveV2LendingPool aaveLendingPool = IAaveV2LendingPool(
            IAaveRateOracle(address(rateOracle)).aaveLendingPool()
        );
        uint256 reserveNormalizedIncome = aaveLendingPool
            .getReserveNormalizedIncome(
                address(IMarginEngine(MEAddress).underlyingToken())
            );
        return reserveNormalizedIncome;
    }

    function addSwapSnapshot(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        int256 variableTokenDelta,
        int256 fixedTokenDeltaUnbalanced,
        uint256 cumulativeFeeIncurred
    ) public {
        bytes32 hashedPositon = keccak256(
            abi.encodePacked(owner, tickLower, tickUpper)
        );

        uint256 termEndTimestampWad = IMarginEngine(MEAddress)
            .termEndTimestampWad();

        uint256 fixedRateWad = PRBMathUD60x18.div(
            PRBMathUD60x18.div(
                PRBMathUD60x18.fromUint(abs(fixedTokenDeltaUnbalanced)),
                PRBMathUD60x18.fromUint(abs(variableTokenDelta))
            ),
            PRBMathUD60x18.fromUint(100)
        );

        // get the current reserve normalized income from Aave
        uint256 reserveNormalizedIncome = getReserveNormalizedIncome();

        SwapSnapshot memory swapSnapshot = SwapSnapshot({
            reserveNormalizedIncomeAtSwap: reserveNormalizedIncome,
            swapInitiationTimestampWad: Time.blockTimestampScaled(),
            termEndTimestampWad: termEndTimestampWad,
            notional: abs(variableTokenDelta),
            isFT: variableTokenDelta > 0 ? false : true,
            fixedRateWad: fixedRateWad,
            feePaidInUnderlyingTokens: cumulativeFeeIncurred
        });

        sizeOfPositionSwapsHistory[hashedPositon] += 1;
        positionSwapsHistory[hashedPositon][
            sizeOfPositionSwapsHistory[hashedPositon]
        ] = swapSnapshot;
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
        (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced
        ) = Actor(params.recipient).swap(VAMMAddress, params);
        keepInMindGas = gasBefore - gasleft();

        continuousInvariants();

        this.addSwapSnapshot(
            params.recipient,
            params.tickLower,
            params.tickUpper,
            _fixedTokenDeltaUnbalanced,
            _variableTokenDelta,
            _cumulativeFeeIncurred
        );
    }

    function liquidatePosition(
        int24 lowerTickLiquidator,
        int24 upperTickLiquidator,
        address liquidator,
        int24 tickLower,
        int24 tickUpper,
        address owner
    ) external {
        this.addPosition(liquidator, lowerTickLiquidator, upperTickLiquidator);
        this.addPosition(owner, tickLower, tickUpper);

        uint256 liquidatorBalanceBefore = IERC20Minimal(
            IMarginEngine(MEAddress).underlyingToken()
        ).balanceOf(liquidator);

        Actor(liquidator).liquidatePosition(
            MEAddress,
            tickLower,
            tickUpper,
            owner
        );

        uint256 liquidatorBalanceAfter = IERC20Minimal(
            IMarginEngine(MEAddress).underlyingToken()
        ).balanceOf(liquidator);

        require(
            liquidatorBalanceBefore <= liquidatorBalanceAfter,
            "liquidation reward should be positive"
        );

        liquidationRewards +=
            int256(liquidatorBalanceAfter) -
            int256(liquidatorBalanceBefore);

        continuousInvariants();
    }

    function estimatedVariableFactorFromStartToMaturity()
        internal
        returns (uint256 _estimatedVariableFactorFromStartToMaturity)
    {
        uint256 historicalAPYWad = IMarginEngine(MEAddress).getHistoricalApy();

        uint256 termStartTimestampWad = IMarginEngine(MEAddress)
            .termStartTimestampWad();
        uint256 termEndTimestampWad = IMarginEngine(MEAddress)
            .termEndTimestampWad();

        uint256 termInYears = FixedAndVariableMath.accrualFact(
            termEndTimestampWad - termStartTimestampWad
        );

        // calculate the estimated variable factor from start to maturity
        _estimatedVariableFactorFromStartToMaturity =
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

    function computeSettlementCashflowForSwapSnapshot(
        SwapSnapshot memory snapshot
    ) internal returns (int256 settlementCashflow) {
        // calculate the variable factor for the period the swap was active
        // needs to be called at the same time as the term end timestamp, otherwise need to cache the reserve normalised income for the term end timestamp in the E2E setup

        uint256 reserveNormalizedIncomeRay = getReserveNormalizedIncome();
        uint256 reserveNormalizedIncomeAtSwapInceptionRay = snapshot
            .reserveNormalizedIncomeAtSwap;
        uint256 variableFactorFromSwapInceptionToMaturityWad = WadRayMath
            .rayToWad(
                WadRayMath
                    .rayDiv(
                        reserveNormalizedIncomeRay,
                        reserveNormalizedIncomeAtSwapInceptionRay
                    )
                    .sub(WadRayMath.RAY)
            );

        // swapInitiationTimestampWad
        uint256 termEndTimestampWad = IMarginEngine(MEAddress)
            .termEndTimestampWad();

        uint256 timeInSecondsBetweenSwapInitiationAndMaturityWad = termEndTimestampWad -
                snapshot.swapInitiationTimestampWad;
        uint256 timeInYearsWad = FixedAndVariableMath.accrualFact(
            timeInSecondsBetweenSwapInitiationAndMaturityWad
        );

        uint256 fixedFactorWad = PRBMathUD60x18.mul(
            snapshot.fixedRateWad,
            timeInYearsWad
        );

        int256 variableFixedFactorDelta;
        if (snapshot.isFT) {
            variableFixedFactorDelta =
                int256(fixedFactorWad) -
                int256(variableFactorFromSwapInceptionToMaturityWad);
        } else {
            variableFixedFactorDelta =
                int256(variableFactorFromSwapInceptionToMaturityWad) -
                int256(fixedFactorWad);
        }

        int256 settlementCashflowWad = PRBMathSD59x18.mul(
            int256(snapshot.notional),
            variableFixedFactorDelta
        );
        settlementCashflow = PRBMathSD59x18.toInt(settlementCashflowWad);
    }

    function settlementCashflowBasedOnSwapSnapshots(
        address _owner,
        int24 tickLower,
        int24 tickUpper
    ) public returns (int256) {
        (
            SwapSnapshot[] memory snapshots,
            uint256 len
        ) = getPositionSwapsHistory(_owner, tickLower, tickUpper);

        int256 settlementCashflow;

        for (uint256 i = 0; i < len; i++) {
            settlementCashflow += computeSettlementCashflowForSwapSnapshot(
                snapshots[i]
            );
        }

        return settlementCashflow;
    }

    function invariantPostMaturity() public {
        // calculate the cashflows for each position based on their swap snapshots and based on their fixed and variable token balances
        // this only works for Positins that have not minted liquidity since their settlementCashflow is also a function of trades in their tick range
        // assume in this scenarios all the swapper only swap

        uint256 termStartTimestampWad = uint256(
            IMarginEngine(MEAddress).termStartTimestampWad()
        );
        uint256 termEndTimestampWad = uint256(
            IMarginEngine(MEAddress).termEndTimestampWad()
        );

        for (uint256 i = 1; i <= sizeAllPositions; i++) {
            uint256 variableFactor = IRateOracle(rateOracleAddress)
                .variableFactor(termStartTimestampWad, termEndTimestampWad);

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

            int256 settlementCashflow = FixedAndVariableMath
                .calculateSettlementCashflow(
                    position.fixedTokenBalance,
                    position.variableTokenBalance,
                    termStartTimestampWad,
                    termEndTimestampWad,
                    variableFactor
                );

            int256 settlementCashflowSS = settlementCashflowBasedOnSwapSnapshots(
                    allPositions[i].owner,
                    allPositions[i].tickLower,
                    allPositions[i].tickUpper
                );

            int256 approximation = 100000;

            int256 delta = settlementCashflow - settlementCashflowSS;

            require(
                abs(delta) < uint256(approximation),
                "settlement cashflows from swap snapshots"
            );
        }
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
            Printer.printUint256("  margin requirement:", marginRequirement);

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
        totalCashflow += int256(liquidationRewards);

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
            -approximation < totalFixedTokens && totalFixedTokens <= 0,
            "fixed tokens don't net out"
        );
        require(
            -approximation < totalVariableTokens && totalVariableTokens <= 0,
            "variable tokens don't net out"
        );
        require(
            initialCashflow >= totalCashflow &&
                totalCashflow > initialCashflow - approximation,
            "system loss: undercollateralized"
        );

        // require(
        //     abs(totalFixedTokens) < uint256(approximation),
        //     "fixed tokens don't net out"
        // );
        // require(
        //     abs(totalVariableTokens) < uint256(approximation),
        //     "variable tokens don't net out"
        // );
        // require(
        //     abs(totalCashflow - initialCashflow) < uint256(approximation),
        //     "cashflows don't net out"
        // );
    }

    function getPositionSwapsHistory(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public returns (SwapSnapshot[] memory, uint256) {
        bytes32 hashedPositon = keccak256(
            abi.encodePacked(owner, tickLower, tickUpper)
        );
        uint256 len = sizeOfPositionSwapsHistory[hashedPositon];
        SwapSnapshot[] memory snapshots = new SwapSnapshot[](len);

        for (uint256 i = 0; i < len; i++) {
            snapshots[i] = positionSwapsHistory[hashedPositon][i + 1];
        }

        return (snapshots, len);
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

    function getSwapsHistory(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public view returns (SwapSnapshot[] memory) {
        bytes32 hashedPositon = keccak256(
            abi.encodePacked(owner, tickLower, tickUpper)
        );
        uint256 len = sizeOfPositionSwapsHistory[hashedPositon];
        SwapSnapshot[] memory snapshots = new SwapSnapshot[](len);

        for (uint256 i = 0; i < len; i++) {
            snapshots[i] = positionSwapsHistory[hashedPositon][i + 1];
        }

        return snapshots;
    }

    function getGasConsumedAtLastTx() external view returns (uint256) {
        return keepInMindGas;
    }
}
