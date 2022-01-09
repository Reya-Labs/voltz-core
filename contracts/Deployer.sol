// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IDeployer.sol";
import "./VAMM.sol";
import "./AMM.sol";
import "./MarginEngine.sol";
import "./core_libraries/FixedAndVariableMath.sol";

contract Deployer is IDeployer {
  
  struct AMMParameters {
    address factory;
    address underlyingToken;
    address rateOracleAddress;
    uint256 termStartTimestamp;
    uint256 termEndTimestamp;
  }

  struct MarginEngineAndVAMMParameters {
    address ammAddress;
  }


  AMMParameters public override ammParameters;
  MarginEngineAndVAMMParameters public override marginEngineParameters;
  MarginEngineAndVAMMParameters public override vammParameters;

  function deployMarginEngine(address ammAddress) internal returns (address marginEngine) {
    marginEngineParameters = MarginEngineAndVAMMParameters({
      ammAddress: ammAddress
    });

    marginEngine = address(
      new MarginEngine{
        salt: keccak256(
          abi.encode(
            ammAddress
          )
        )
      }()
    );

    delete marginEngineParameters;

  }
  
  function deployVAMM(
    address ammAddress
  ) internal returns (address vamm) {
    
    vammParameters = MarginEngineAndVAMMParameters({
      ammAddress: ammAddress
    });

    vamm = address(
      new VAMM{
        salt: keccak256(
          abi.encode(
            ammAddress
          )
        )
      }()
    );
    delete vammParameters;
  }
  
  /// @dev Deploys an amm with the given parameters by transiently setting the parameters storage slot and then
  /// clearing it after deploying the amm.
  /// @param factory The contract address of the Voltz factory
  /// @param underlyingToken The contract address of the token in the underlying pool
  /// @param rateOracleAddress rate oracle address
  /// @param termEndTimestamp Number of days between the inception of the pool and its maturity
  function deployAMM(
    address factory,
    address underlyingToken,
    address rateOracleAddress,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  ) internal returns (address amm) {

    ammParameters = AMMParameters({
      factory: factory,
      underlyingToken: underlyingToken,
      rateOracleAddress: rateOracleAddress,
      termStartTimestamp: termStartTimestamp,
      termEndTimestamp: termEndTimestamp
    });

    amm = address(
      new AMM{
        salt: keccak256(
          abi.encode(
            rateOracleAddress,
            underlyingToken, // redundunt since the rateOracleAddress incorporates the underlying token?
            termStartTimestamp,
            termEndTimestamp
          )
        )
      }()
    );
    delete ammParameters;
  }
}
