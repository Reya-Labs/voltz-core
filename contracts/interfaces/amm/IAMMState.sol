pragma solidity ^0.8.0;

/// @title AMM state that can change
/// @notice These methods compose the amm's state, and can change with any frequency including multiple times
/// per transaction
interface IAMMState {
    /// @notice The 0th storage slot in the amm stores many values, and is exposed as a single method to save gas
    /// when accessed externally.
    /// @return sqrtPriceX96 The current price of the amm as a sqrt(token1/token0) Q64.96 value
    /// tick The current tick of the amm, i.e. according to the last tick transition that was run.
    /// This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(sqrtPriceX96) if the price is on a tick
    /// boundary.
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            bool unlocked
        );

    /// @notice The fee growth as a Q128.128 fees of underlying Token collected per unit of liquidity for the entire life of the amm
    /// @dev This value can overflow the uint256
    function feeGrowthGlobalX128() external view returns (uint256);

    /// @notice The currently in range liquidity available to the amm
    /// @dev This value has no relationship to the total liquidity across all ticks
    function liquidity() external view returns (uint128);

    /// @notice balance of virtual fixed 1% tokens in the amm
    function balance0() external view returns (uint256);

    /// @notice balance of virtual variable tokens in the amm
    function balance1() external view returns (uint256);

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
            uint256 feeGrowthOutsideX128
        );

    /// @notice Returns 256 packed tick initialized boolean values. See TickBitmap for more information
    function tickBitmap(int16 wordPosition) external view returns (uint256);

    /// @notice Returns the information about a position by the position's key
    /// @param key The position's key is a hash of a preimage composed by the owner, tickLower and tickUpper
    function positions(bytes32 key)
        external
        view
        returns (
            uint128 liquidity,
            uint256 feeGrowthInsideLastX128,
            uint256 margin
        );

    /// @notice Returns the information about a trader by the trader key
    /// @param key The trader's key is a hash of a preimage composed by the owner, notional, fixedRate
    function traders(bytes32 key)
        external
        view
        returns (
            int256 notional,
            uint256 fixedRate,            
            uint256 margin,
            bool settled
        );


    
}
