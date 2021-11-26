pragma solidity ^0.8.0;
import "../IMarginCalculator.sol";
import "../rate_oracles/IRateOracle.sol";

/// @title Pool state that never changes
/// @notice These parameters are fixed for a amm forever, i.e., the methods will always return the same values
interface IAMMImmutables {

    /// @notice Margin calculator interface
    /// @return The margin calculator interface
    function calculator() external view returns (IMarginCalculator);

    
    function rateOracle() external view returns (IRateOracle);

    /// @notice The contract that deployed the amm, which must adhere to the AMMFactory interface
    /// @return The contract address
    function factory() external view returns (address);

    // /// @notice The address of the underlying pool token
    // /// @return The underlying pool token address
    function underlyingToken() external view returns (address);

    function rateOracleId() external view returns (bytes32);

    function termEndTimestamp() external view returns (uint256);

    /// @notice Timestamp of amm creation
    /// @return Timestamp
    function termStartTimestamp() external view returns (uint256);

    /// @notice The amm's fee in hundredths of a bip, i.e. 1e-6
    /// @return The fee
    function fee() external view returns (uint256);

    /// @notice The amm tick spacing
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
}
