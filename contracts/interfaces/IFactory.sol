// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs
interface IFactory {
    /// @notice Emitted when the owner of the factory is changed
    /// @param oldOwner The owner before the owner was changed
    /// @param newOwner The owner after the owner was changed
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    /// @notice Emitted when calculator address is changed
    /// @param newCalculator The new calculator address after it was changed by owner
    event CalculatorChanged(address indexed newCalculator);

    /// @notice Emmited when Rate Oracle Address is changed
    /// @param rateOracleAddress The rate oracle Id
    /// @param newOracleAddress The rate oracle address given its Id
    event RateOracleAdded(
        address indexed rateOracleAddress,
        address newOracleAddress
    );

    /// @notice Emitted when an AMM is successfully created
    /// @param ammAddress The new AMM's address
    /// @param tokenAddress The new AMM's token
    /// @param rateOracleAddress The new AMM's rate oracle ID in Factory.getAMMMap
    /// @param termStartTimestamp The new AMM's term start timestamp in wei-seconds (ie the deployed block time)
    /// @param termEndTimestamp The new AMM's maturity date in wei-seconds
    event AMMCreated(
        address indexed ammAddress,
        address indexed tokenAddress,
        address indexed rateOracleAddress,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    );

    /// @notice Returns the current owner of the factory
    /// @dev Can be changed by the current owner via setOwner
    /// @return The address of the factory owner
    function owner() external view returns (address);

    /// @notice Returns the current calculator of the factory
    /// @dev Can be changed by the current owner via setCalculator
    /// @return The address of the calculator
    function calculator() external view returns (address);

    /// @notice Returns the amm address for a given rateOracleAddress, underlyingToken, termStartTimestamp, termEndTimestamp
    /// @param rateOracleAddress The bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
    /// @param underlyingToken The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC)
    /// @param termStartTimestamp The block.timestamp of amm inception
    /// @param termEndTimestamp The block.timestamp of amm maturity
    /// @return amm The amm address
    function getAMMMap(
        address rateOracleAddress,
        address underlyingToken,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) external view returns (address);

    /// @notice Returns vAMM address for a given AMM address
    /// @param ammAddress The address of the AMM
    /// @return vAMM The vAMM address
    function getVAMMMap(address ammAddress) external view returns (address);

    /// @notice Returns Margin Engine address for a given AMM address
    /// @param ammAddress The address of the AMM
    /// @return marginEngine The Margin Engine address
    function getMarginEngineMap(address ammAddress)
        external
        view
        returns (address);

    /// @notice Updates the owner of the factory
    /// @dev Must be called by the current owner
    /// @param _owner The new owner of the factory
    function setOwner(address _owner) external;

    /// @notice Updates the calculator of the factory
    /// @dev Must be called by the current owner
    /// @param _calculator The new calculator of the factory
    function setCalculator(address _calculator) external;

    /// @notice Creates an amm for a given underlying token (e.g. USDC), rateOracleAddress, and termEndTimestamp
    /// @param underlyingToken The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC)
    /// @param rateOracleAddress A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound)
    /// @dev The call will revert if the amm already exists, underlying token is invalid, the rateOracleAddress is invalid or the termEndTimeStamp is invalid
    /// @return amm The address of the newly created amm
    function createAMM(
        address underlyingToken,
        address rateOracleAddress,
        uint256 termEndTimestamp
    ) external returns (address amm);

    /// @notice Creates a concentrated liquidity virtual automated market maker (VAMM) for a given amm
    /// @param ammAddress The parent AMM of the VAMM
    /// @dev The call will revert if the VAMM already exists, amm is invalid
    /// @return vamm The address of the newly created VAMM
    function createVAMM(address ammAddress) external returns (address vamm);

    /// @notice Creates the Margin Engine for a given AMM (core function: overall margin management, i.g. cash-flows, settlements, liquidations)
    /// @param ammAddress The parent AMM of the Margin Engine
    /// @dev The call will revert if the Margin Engine already exists, amm is invalid
    /// @return marginEngine The address of the newly created Margin Engine
    function createMarginEngine(address ammAddress)
        external
        returns (address marginEngine);
}
