// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "./IAMM.sol";
import "./IPositionStructs.sol";

interface IVAMM is IPositionStructs {

    // structs
    struct Slot0 {
        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;
        // the current protocol fee as a percentage of the swap fee taken on withdrawal
        uint256 feeProtocol;
    }

    // events
    event Mint(
        address sender,
        address indexed owner,
        int24 indexed tickLower,
        int24 indexed tickUpper,
        uint128 amount
    );

    event Swap(
        address indexed sender,
        address indexed recipient,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick
    );

    event Initialize(uint160 sqrtPriceX96, int24 tick);
    
    // todo: trim the structs
    struct SwapParams {
        address recipient;
        bool isFT; // equivalent to !zeroForOne
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
        bool isUnwind;
        bool isTrader;
    }

    struct SwapCache {
        // liquidity at the beginning of the swap
        uint128 liquidityStart;
        // the timestamp of the current block
        uint256 blockTimestamp;

        // the protocol fee for the underlying token (is this a percentage amount?)
        uint256 feeProtocol;
    }

    // the top level state of the swap, the results of which are recorded in storage at the end
    struct SwapState {
        // the amount remaining to be swapped in/out of the input/output asset
        int256 amountSpecifiedRemaining;
        // the amount already swapped out/in of the output/input asset
        int256 amountCalculated;
        // current sqrt(price)
        uint160 sqrtPriceX96;
        // the tick associated with the current price
        int24 tick;

        int256 fixedTokenGrowthGlobal;

        int256 variableTokenGrowthGlobal;

        // the current liquidity in range
        uint128 liquidity;

        uint256 feeGrowthGlobal;
        // amount of input token paid as protocol fee
        uint256 protocolFee;
    }

    struct StepComputations {
        // the price at the beginning of the step
        uint160 sqrtPriceStartX96;
        // the next tick to swap to from the current tick in the swap direction
        int24 tickNext;
        // whether tickNext is initialized or not
        bool initialized;
        // sqrt(price) for the next tick (1/0)
        uint160 sqrtPriceNextX96;
        // how much is being swapped in in this step
        uint256 amountIn;
        // how much is being swapped out
        uint256 amountOut;
        // how much fee is being paid in (underlying token)
        uint256 feeAmount;

    }

    struct InitiateIRSParams {
        // trader's address
        address traderAddress;
        // the lower and upper tick of the position

        int256 fixedTokenBalance;
        int256 variableTokenBalance;

        int256 margin;
        bool settled;
    }
    
    struct UpdatePositionVars {
        
        bool flippedLower;
        bool flippedUpper;

        int256 fixedTokenGrowthInside;
        int256 variableTokenGrowthInside;

        uint256 feeGrowthInside;
    }

    // immutables

    function fee() external view returns (uint256);

    /// @notice The vamm tick spacing
    /// @dev Ticks can only be used at multiples of this value, minimum of 1 and always positive
    /// e.g.: a tickSpacing of 3 means ticks can be initialized every 3rd tick, i.e., ..., -6, -3, 0, 3, 6, ...
    /// This value is an int24 to avoid casting even though it is always positive.
    /// @return The tick spacing
    function tickSpacing() external view returns (int24);

    /// @notice The maximum amount of position liquidity that can use any tick in the range
    /// @dev This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
    /// also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to an amm
    /// @return The max amount of liquidity per tick
    function maxLiquidityPerTick() external view returns (uint128);


    // state variables

    function slot0()
    external
    view
    returns (
      uint160 sqrtPriceX96,
      int24 tick,
      uint256 feeProtocol
    );

    function fixedTokenGrowthGlobal() external view returns (int256);

    function variableTokenGrowthGlobal() external view returns (int256);

    function feeGrowthGlobal() external view returns (uint256);

    /// @notice The currently in range liquidity available to the vamm
    function liquidity() external view returns (uint128);

    function protocolFees() external view returns (uint256);

    function amm() external view returns (IAMM);

    function setAMM(address _ammAddress) external;

    function setFeeProtocol(uint256 feeProtocol) external;

    function updateProtocolFees(uint256 protocolFeesCollected) external;

    function initialize(uint160 sqrtPriceX96) external;

    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external;

    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external;

    function swap(
        SwapParams memory params
    ) external returns (int256 _fixedTokenDelta, int256 _variableTokenDelta);

  /// @notice Look up information about a specific tick in the amm
  /// @param tick The tick to look up
  /// @return liquidityGross the total amount of position liquidity that uses the amm either as tick lower or
  /// tick upper,
  /// liquidityNet how much liquidity changes when the amm price crosses the tick,
  /// feeGrowthOutsideX128 the fee growth on the other side of the tick from the current tick in underlying Token
  /// i.e. if liquidityGross is greater than 0. In addition, these values are only relative and are used to
  /// compute snapshots.
  function ticks(int24 tick)
    external
    view
    returns (
      uint128 liquidityGross,
      int128 liquidityNet,
      int256 fixedTokenGrowthOutside,
      int256 variableTokenGrowthOutside,
      uint256 feeGrowthOutside,
      bool initialized
    );

  /// @notice Returns 256 packed tick initialized boolean values. See TickBitmap for more information
  function tickBitmap(int16 wordPosition) external view returns (uint256);

  function computePositionFixedAndVariableGrowthInside(ModifyPositionParams memory params, int24 currentTick)
     external view returns(int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside);

}