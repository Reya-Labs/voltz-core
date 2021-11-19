// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs and control over the protocol fees
interface IAMMFactory {
    /// @notice Emitted when the owner of the factory is changed
    /// @param oldOwner The owner before the owner was changed
    /// @param newOwner The owner after the owner was changed
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    /// @notice Emitted when a amm is created
    event AMMCreated(
        address indexed underlyingPool,
        address indexed underlyingToken,
        uint256 indexed termStartTimestamp,
        uint256 termEndTimestamp,
        uint24 fee,
        int24 tickSpacing,
        address amm
    );

    /// @notice Emitted when a new fee amount is enabled for pool creation via the factory
    /// @param fee The enabled fee, denominated in hundredths of a bip
    /// @param tickSpacing The minimum number of ticks between initialized ticks for pools created with the given fee
    event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing);

    /// @notice Returns the current owner of the factory
    /// @dev Can be changed by the current owner via setOwner
    /// @return The address of the factory owner
    function owner() external view returns (address);

    /// @notice Returns the tick spacing for a given fee amount, if enabled, or 0 if not enabled
    /// @dev A fee amount can never be removed, so this value should be hard coded or cached in the calling context
    /// @param fee The enabled fee, denominated in hundredths of a bip. Returns 0 in case of unenabled fee
    /// @return The tick spacing
    function feeAmountTickSpacing(uint24 fee) external view returns (int24);

    /// @notice Returns the amm address for a given pair of tokens and a fee, or address 0 if it does not exist
    /// @dev tokenA and tokenB may be passed in either token0/token1 or token1/token0 order
    /// @param underlyingPool The contract address of the underlying pool
    /// @param termEndTimestamp Number of days between the inception of the pool and its maturity
    /// @param termStartTimestamp Timestamp of pool initialisation
    /// @param fee The fee collected upon every swap in the pool (as a percentage of notional traded), denominated in hundredths of a bip
    /// @return amm The amm address
    // function getAMM( // todo: fix
    //     address underlyingPool,
    //     uint256 termEndTimestamp,
    //     uint32 termStartTimestamp,
    //     uint24 fee
    // ) external view returns (address amm);

    /// @notice Creates an amm
    /// @param underlyingPool The contract address of the underlying pool
    /// @param termEndTimestamp Number of days between the inception of the pool and its maturity
    /// @param fee The fee collected upon every swap in the pool (as a percentage of notional traded), denominated in hundredths of a bip
    /// @return amm The address of the newly created amm
    function createAMM(
        address underlyingToken,
        address underlyingPool,
        uint256 termEndTimestamp,
        uint24 fee
    ) external returns (address amm);

    /// @notice Updates the owner of the factory
    /// @dev Must be called by the current owner
    /// @param _owner The new owner of the factory
    function setOwner(address _owner) external;

    /// @notice Enables a fee amount with the given tickSpacing
    /// @dev Fee amounts may never be removed once enabled
    /// @param fee The fee amount to enable, denominated in hundredths of a bip (i.e. 1e-6)
    /// @param tickSpacing The spacing between ticks to be enforced for all pools created with the given fee amount
    function enableFeeAmount(uint24 fee, int24 tickSpacing) external;
}
