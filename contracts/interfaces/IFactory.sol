// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs and control over the protocol fees
interface IFactory {
  /// @notice Emitted when the owner of the factory is changed
  /// @param oldOwner The owner before the owner was changed
  /// @param newOwner The owner after the owner was changed
  event OwnerChanged(address indexed oldOwner, address indexed newOwner);

  /// @notice Returns the current owner of the factory
  /// @dev Can be changed by the current owner via setOwner
  /// @return The address of the factory owner
  function owner() external view returns (address);

  function treasury() external view returns (address);

  function calculator() external view returns (address);

  function insuranceFund() external view returns (address);

  function getRateOracleAddress(bytes32 rateOracleId)
    external
    view
    returns (address);

  function setTreasury(address _treasury) external;

  function setCalculator(address _calculator) external;

  function setInsuranceFund(address _insuranceFund) external;

  function createVAMM(
        address ammAddress
  ) external returns (address vamm);

  function createMarginEngine(
    address ammAddress
  ) external returns (address marginEngine);

  function createAMM(
    address underlyingToken,
    bytes32 rateOracleId,
    uint256 termEndTimestamp
  ) external returns (address amm);

  /// @notice Updates the owner of the factory
  /// @dev Must be called by the current owner
  /// @param _owner The new owner of the factory
  function setOwner(address _owner) external;

  //   // @notice Enables a fee amount with the given tickSpacing
  //   // @dev Fee amounts may never be removed once enabled
  //   // @param fee The fee amount to enable, denominated in hundredths of a bip (i.e. 1e-6)
  //   // @param tickSpacing The spacing between ticks to be enforced for all pools created with the given fee amount
  //   function enableFeeAmount(uint24 fee, int24 tickSpacing) external;

  function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress)
    external;
}
