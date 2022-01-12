// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IDeployer.sol";
import "./VAMM.sol";
import "./MarginEngine.sol";

contract Deployer is IDeployer {
  
  struct MarginEngineParameters {
    address factory;
    address underlyingToken;
    bytes32 rateOracleId;
    uint256 termStartTimestamp;
    uint256 termEndTimestamp;
  }

  struct VAMMParameters {
    address marginEngineAddress;
  }

  MarginEngineParameters public override marginEngineParameters;
  VAMMParameters public override vammParameters;

  function deployMarginEngine(
    address factory,
    address underlyingToken,
    bytes32 rateOracleId,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
    ) internal returns (address marginEngine) {
    
    marginEngineParameters = MarginEngineParameters({
      factory: factory,
      underlyingToken: underlyingToken,
      rateOracleId: rateOracleId,
      termStartTimestamp: termStartTimestamp,
      termEndTimestamp: termEndTimestamp
    });

    marginEngine = address(
      new MarginEngine{
        salt: keccak256(
          abi.encode(
            rateOracleId,
            underlyingToken, // redundunt since the rateOracleId incorporates the underlying token?
            termStartTimestamp,
            termEndTimestamp
          )
        )
      }()
    );

    delete marginEngineParameters;

  }
  
  function deployVAMM(
    address marginEngineAddress
  ) internal returns (address vamm) {
    
    vammParameters = VAMMParameters({
      marginEngineAddress: marginEngineAddress
    });

    vamm = address(
      new VAMM{
        salt: keccak256(
          abi.encode(
            marginEngineAddress
          )
        )
      }()
    );
    delete vammParameters;
  }
  
}
