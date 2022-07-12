// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "contracts/test/Actor.sol";
import "contracts/test/TestMarginEngine.sol";
import "contracts/test/TestVAMM.sol";
import "contracts/test/TestAaveFCM.sol";
import "contracts/test/MockAaveLendingPool.sol";
import "contracts/test/MockCToken.sol";
import "contracts/utils/Printer.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IPeriphery.sol";
import "../utils/WadRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "contracts/utils/CustomErrors.sol";

contract E2ESetup is CustomErrors {
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

    mapping(uint256 => address) public allYBATraders;
    mapping(address => uint256) public indexAllYBATraders;
    uint256 public sizeAllYBATraders = 0;

    mapping(bytes32 => mapping(uint256 => PositionSnapshot))
        public positionHistory;
    mapping(bytes32 => uint256) public sizeOfPositionHistory;

    mapping(bytes32 => mapping(uint256 => SwapSnapshot))
        public positionSwapsHistory;
    mapping(bytes32 => uint256) public sizeOfPositionSwapsHistory;

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

        uint256 reserveNormalizedIncome = 1;

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

    function addYBATrader(address trader) public {
        if (indexAllYBATraders[trader] > 0) {
            return;
        }
        sizeAllYBATraders += 1;
        allYBATraders[sizeAllYBATraders] = trader;
        indexAllYBATraders[trader] = sizeAllYBATraders;
    }

    address public MEAddress;
    address public VAMMAddress;
    address public FCMAddress;
    address public rateOracleAddress;
    address public peripheryAddress;
    address public aaveLendingPool;
    address public cToken;

    function setPeripheryAddress(address _peripheryAddress) public {
        peripheryAddress = _peripheryAddress;
    }

    function setMEAddress(address _MEAddress) public {
        MEAddress = _MEAddress;
    }

    function setVAMMAddress(address _VAMMAddress) public {
        VAMMAddress = _VAMMAddress;
    }

    function setFCMAddress(address _FCMAddress) public {
        FCMAddress = _FCMAddress;
    }

    function setRateOracleAddress(address _rateOracleAddress) public {
        rateOracleAddress = _rateOracleAddress;
    }

    function setAaveLendingPool(address _aaveLendingPool) public {
        aaveLendingPool = _aaveLendingPool;
    }

    function setCToken(address _cToken) public {
        cToken = _cToken;
    }

    function initiateFullyCollateralisedFixedTakerSwap(
        address trader,
        uint256 notional,
        uint160 sqrtPriceLimitX96
    ) external {
        addYBATrader(trader);

        uint256 MEBalanceBefore = IERC20Minimal(
            IMarginEngine(MEAddress).underlyingToken()
        ).balanceOf(MEAddress);

        Actor(trader).initiateFullyCollateralisedFixedTakerSwap(
            FCMAddress,
            notional,
            sqrtPriceLimitX96
        );

        uint256 MEBalanceAfter = IERC20Minimal(
            IMarginEngine(MEAddress).underlyingToken()
        ).balanceOf(MEAddress);
    }

    function unwindFullyCollateralisedFixedTakerSwap(
        address trader,
        uint256 notionalToUnwind,
        uint160 sqrtPriceLimitX96
    ) external {
        addYBATrader(trader);

        uint256 MEBalanceBefore = IERC20Minimal(
            IMarginEngine(MEAddress).underlyingToken()
        ).balanceOf(MEAddress);

        Actor(trader).unwindFullyCollateralisedFixedTakerSwap(
            FCMAddress,
            notionalToUnwind,
            sqrtPriceLimitX96
        );

        uint256 MEBalanceAfter = IERC20Minimal(
            IMarginEngine(MEAddress).underlyingToken()
        ).balanceOf(MEAddress);
    }

    function settleYBATrader(address trader) external {
        addYBATrader(trader);

        Actor(trader).settleYBATrader(FCMAddress);
    }

    function settlePositionViaAMM(
        address recipient,
        int24 tickLower,
        int24 tickUpper
    ) external {
        addPosition(recipient, tickLower, tickUpper);

        Actor(recipient).settlePositionViaAMM(
            MEAddress,
            recipient,
            tickLower,
            tickUpper
        );
    }

    function mintOrBurnViaPeriphery(
        address trader,
        IPeriphery.MintOrBurnParams memory params
    ) public payable returns (int256 positionMarginRequirement) {
        addPosition(trader, params.tickLower, params.tickUpper);
        positionMarginRequirement = Actor(trader).mintOrBurnViaPeriphery{
            value: msg.value
        }(peripheryAddress, params);
    }

    function swapViaPeriphery(
        address trader,
        IPeriphery.SwapPeripheryParams memory params
    )
        public
        payable
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement
        )
    {
        addPosition(trader, params.tickLower, params.tickUpper);
        (
            _fixedTokenDelta,
            _variableTokenDelta,
            _cumulativeFeeIncurred,
            _fixedTokenDeltaUnbalanced,
            _marginRequirement
        ) = Actor(trader).swapViaPeriphery{value: msg.value}(
            peripheryAddress,
            params
        );
    }

    function mintViaAMM(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) public returns (int256 positionMarginRequirement) {
        this.addPosition(recipient, tickLower, tickUpper);

        positionMarginRequirement = Actor(recipient).mintViaAMM(
            VAMMAddress,
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

    function burnViaAMM(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) public {
        this.addPosition(recipient, tickLower, tickUpper);

        Actor(recipient).burnViaAMM(
            VAMMAddress,
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

    function swapViaAMM(IVAMM.SwapParams memory params)
        public
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement
        )
    {
        this.addPosition(params.recipient, params.tickLower, params.tickUpper);

        (
            _fixedTokenDelta,
            _variableTokenDelta,
            _cumulativeFeeIncurred,
            _fixedTokenDeltaUnbalanced,
            _marginRequirement
        ) = Actor(params.recipient).swapViaAMM(VAMMAddress, params);

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
        address liquidator,
        int24 lowerTickLiquidator,
        int24 upperTickLiquidator,
        address owner,
        int24 tickLower,
        int24 tickUpper
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
    }

    function setIntegrationApproval(
        address recipient,
        address intAddress,
        bool allowIntegration
    ) external {
        Actor(recipient).setIntegrationApproval(
            MEAddress,
            intAddress,
            allowIntegration
        );
    }

    function updatePositionMarginViaAMM(
        address _owner,
        int24 tickLower,
        int24 tickUpper,
        int256 marginDelta
    ) public {
        this.addPosition(_owner, tickLower, tickUpper);

        Actor(_owner).updatePositionMarginViaAMM(
            MEAddress,
            _owner,
            tickLower,
            tickUpper,
            marginDelta
        );
    }

    function getPositionSwapsHistory(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public view returns (SwapSnapshot[] memory, uint256) {
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

    function setNewRate(uint256 rate) public {
        uint8 yieldBearingProtocolID = IRateOracle(rateOracleAddress)
            .UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

        IERC20Minimal underlyingToken = IRateOracle(rateOracleAddress)
            .underlying();

        if (yieldBearingProtocolID == 1) {
            // Aave
            MockAaveLendingPool(aaveLendingPool).setReserveNormalizedIncome(
                underlyingToken,
                rate
            );
        }

        if (yieldBearingProtocolID == 2) {
            // Compound
            MockCToken(cToken).setExchangeRate(rate);
        }

        IRateOracle(rateOracleAddress).writeOracleEntry();
    }
}
