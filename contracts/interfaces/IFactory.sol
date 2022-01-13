// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs
interface IFactory {
    /// @notice Emitted when the owner of the factory is changed
    /// @param oldOwner The owner before the owner was changed
    /// @param newOwner The owner after the owner was changed
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    /// @notice Emmited when Rate Oracle Address is changed
    /// @param rateOracleId The rate oracle Id
    /// @param newOracleAddress The rate oracle address given its Id
    event RateOracleAdded(
        bytes32 indexed rateOracleId,
        address newOracleAddress
    );

    /// @notice Emitted when an AMM is successfully created
    /// @param ammAddress The new AMM's address
    /// @param tokenAddress The new AMM's token
    /// @param rateOracleId The new AMM's rate oracle ID in Factory.getAMMMap
    /// @param termStartTimestamp The new AMM's term start timestamp in wei-seconds (ie the deployed block time)
    /// @param termEndTimestamp The new AMM's maturity date in wei-seconds
    event AMMCreated(
        address indexed ammAddress,
        address indexed tokenAddress,
        bytes32 indexed rateOracleId,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    );

    /// @notice Returns the current owner of the factory
    /// @dev Can be changed by the current owner via setOwner
    /// @return The address of the factory owner
    function owner() external view returns (address);

    /// @notice Returns the address of the Rate Oracle Contract
    /// @param rateOracleId The bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
    /// @return The address of the Rate Oracle Contract
    function getRateOracleAddress(bytes32 rateOracleId)
        external
        view
        returns (address);

    /// @notice Returns the amm address for a given rateOracleId, underlyingToken, termStartTimestamp, termEndTimestamp
    /// @param rateOracleId The bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
    /// @param underlyingToken The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC)
    /// @param termStartTimestamp The block.timestamp of amm inception
    /// @param termEndTimestamp The block.timestamp of amm maturity
    /// @return amm The amm address
    function getMarginEngineMap(
        bytes32 rateOracleId,
        address underlyingToken,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) external view returns (address);

    /// @notice Returns vAMM address for a given AMM address
    /// @param marginEngineAddress The address of the AMM
    /// @return vAMM The vAMM address
    function getVAMMMap(address marginEngineAddress)
        external
        view
        returns (address);

    /// @notice Updates the owner of the factory
    /// @dev Must be called by the current owner
    /// @param _owner The new owner of the factory
    function setOwner(address _owner) external;

    /// @notice Creates an amm for a given underlying token (e.g. USDC), rateOracleId, and termEndTimestamp
    /// @param underlyingToken The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC)
    /// @param rateOracleId A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound)
    /// @dev The call will revert if the amm already exists, underlying token is invalid, the rateOracleId is invalid or the termEndTimeStamp is invalid
    /// @return marginEngine The address of the newly created amm
    function createMarginEngine(
        address underlyingToken,
        bytes32 rateOracleId,
        uint256 termEndTimestamp
    ) external returns (address marginEngine);

    /// @notice Creates a concentrated liquidity virtual automated market maker (VAMM) for a given amm
    /// @param marginEngineAddress The parent AMM of the VAMM
    /// @dev The call will revert if the VAMM already exists, amm is invalid
    /// @return vamm The address of the newly created VAMM
    function createVAMM(address marginEngineAddress)
        external
        returns (address vamm);

    /// @notice Adds a new Rate Oracle to the mapping getRateOracleAddress
    /// @param _rateOracleId A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound)
    /// @param _rateOracleAddress Address of the Rate Oracle linked (e.g. Aave v2 Lending Pool)
    /// @dev The call will revert if the _rateOracleId is invalid, if the _rateOracleAddress is invalid, rate oracle with that address has the given id, key/value already exist in the mapping
    function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress)
        external;
}
