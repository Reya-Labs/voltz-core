// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "../interfaces/aave/IAaveV3LendingPool.sol";
import "../utils/WadRayMath.sol";

import "hardhat/console.sol";

contract MockAaveV3LendingPool is IAaveV3LendingPool {
    using WadRayMath for uint256;

    struct ReserveData {
        //stores the reserve configuration
        ReserveConfigurationMap configuration;
        //the liquidity index. Expressed in ray
        uint128 liquidityIndex;
        //the current supply rate. Expressed in ray
        uint128 currentLiquidityRate;
        //variable borrow index. Expressed in ray
        uint128 variableBorrowIndex;
        //the current variable borrow rate. Expressed in ray
        uint128 currentVariableBorrowRate;
        //the current stable borrow rate. Expressed in ray
        uint128 currentStableBorrowRate;
        //timestamp of last update
        uint40 lastUpdateTimestamp;
        //the id of the reserve. Represents the position in the list of the active reserves
        uint16 id;
        //aToken address
        address aTokenAddress;
        //stableDebtToken address
        address stableDebtTokenAddress;
        //variableDebtToken address
        address variableDebtTokenAddress;
        //address of the interest rate strategy
        address interestRateStrategyAddress;
        //the current treasury balance, scaled
        uint128 accruedToTreasury;
        //the outstanding unbacked aTokens minted through the bridging feature
        uint128 unbacked;
        //the outstanding debt borrowed against this asset in isolation mode
        uint128 isolationModeTotalDebt;
    }

    struct ReserveConfigurationMap {
        //bit 0-15: LTV
        //bit 16-31: Liq. threshold
        //bit 32-47: Liq. bonus
        //bit 48-55: Decimals
        //bit 56: reserve is active
        //bit 57: reserve is frozen
        //bit 58: borrowing is enabled
        //bit 59: stable rate borrowing enabled
        //bit 60: asset is paused
        //bit 61: borrowing in isolation mode is enabled
        //bit 62-63: reserved
        //bit 64-79: reserve factor
        //bit 80-115 borrow cap in whole tokens, borrowCap == 0 => no cap
        //bit 116-151 supply cap in whole tokens, supplyCap == 0 => no cap
        //bit 152-167 liquidation protocol fee
        //bit 168-175 eMode category
        //bit 176-211 unbacked mint cap in whole tokens, unbackedMintCap == 0 => minting disabled
        //bit 212-251 debt ceiling for isolation mode with (ReserveConfiguration::DEBT_CEILING_DECIMALS) decimals
        //bit 252-255 unused

        uint256 data;
    }

    enum InterestRateMode {
        NONE,
        STABLE,
        VARIABLE
    }

    struct InitReserveParams {
        address asset;
        address aTokenAddress;
        address stableDebtAddress;
        address variableDebtAddress;
        address interestRateStrategyAddress;
        uint16 reservesCount;
        uint16 maxNumberReserves;
    }

    // Map of reserves and their data (underlyingAssetOfReserve => reserveData)
    mapping(address => ReserveData) internal _reserves;

    // List of reserves as a map (reserveId => reserve).
    // It is structured as a mapping for gas savings reasons, using the reserve id as index
    mapping(uint256 => address) internal _reservesList;

    // Available liquidity that can be borrowed at once at stable rate, expressed in bps
    uint64 internal _maxStableRateBorrowSizePercent;

    // Maximum number of active reserves there have been in the protocol. It is the upper bound of the reserves list
    uint16 internal _reservesCount;

    uint256 public constant POOL_REVISION = 0x1;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    function initialize() external virtual {
        _maxStableRateBorrowSizePercent = 0.25e4;
    }

    function getReserveNormalizedIncome(address asset)
        external
        view
        virtual
        override
        returns (uint256)
    {
        uint40 timestamp = _reserves[asset].lastUpdateTimestamp;
        console.log(
            "Last updated timestamp",
            _reserves[asset].lastUpdateTimestamp
        );

        //solium-disable-next-line
        if (timestamp == block.timestamp) {
            //if the index was updated in the same block, no need to perform any calculation
            console.log("Direct");
            return _reserves[asset].liquidityIndex;
        } else {
            console.log("Calculation");
            return
                calculateLinearInterest(
                    _reserves[asset].currentLiquidityRate,
                    timestamp
                ).rayMul(_reserves[asset].liquidityIndex);
        }
    }

    function calculateLinearInterest(uint256 rate, uint40 lastUpdateTimestamp)
        internal
        view
        returns (uint256)
    {
        //solium-disable-next-line
        console.log("Timestamps", block.timestamp, "-", lastUpdateTimestamp);
        console.log("Rate", block.timestamp - uint256(lastUpdateTimestamp));
        uint256 result = rate *
            (block.timestamp - uint256(lastUpdateTimestamp));
        unchecked {
            result = result / SECONDS_PER_YEAR;
        }

        return 1e27 + result;
    }

    function setReserveNormalizedIncome(
        address _underlyingAsset,
        uint128 reserveNormalizedIncome
    ) public {
        console.log(block.timestamp);

        _reserves[_underlyingAsset].liquidityIndex = reserveNormalizedIncome;
        _reserves[_underlyingAsset]
            .currentLiquidityRate = reserveNormalizedIncome;
        require((block.timestamp == uint40(block.timestamp)), "TSOFLOW");
        _reserves[_underlyingAsset].lastUpdateTimestamp = uint40(
            block.timestamp
        );

        console.log(_reserves[_underlyingAsset].lastUpdateTimestamp);
    }
}
